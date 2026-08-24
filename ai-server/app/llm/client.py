"""LLM 호출 래퍼 — 타임아웃·오류를 계약 오류 코드로 매핑하고, 예산 내 1회 재시도를 담당한다.

로그에는 소요 시간·토큰 수·실패 사유 코드만 남긴다. 이미지·추출 텍스트·LLM 원문은 남기지 않는다(NFR-08).
"""

import asyncio
import logging
import time
from typing import Any, TypeVar

import anthropic
from anthropic import AsyncAnthropic
from pydantic import BaseModel, ValidationError

from ..config import settings
from ..errors import ContractError, draft_failed, extraction_failed, quota_exceeded, timeout_error
from . import prompts

log = logging.getLogger("ai.llm")

_client: AsyncAnthropic | None = None
_semaphore: asyncio.Semaphore | None = None

T = TypeVar("T", bound=BaseModel)


def _get_client() -> AsyncAnthropic:
    """지연 생성. 임포트 시점에 만들면 API 키가 없을 때 서버가 아예 뜨지 못한다.

    배포는 LLM 키 확정보다 먼저 이루어질 수 있어야 한다 — 키가 없어도
    `/internal/health`는 200을 돌려주고, 실제 LLM 경로만 계약 오류로 실패한다.
    """
    global _client
    if _client is None:
        _client = AsyncAnthropic(max_retries=0)
    return _client


def _sem() -> asyncio.Semaphore:
    global _semaphore
    if _semaphore is None:
        _semaphore = asyncio.Semaphore(settings.max_concurrency)
    return _semaphore


class LLMCallFailed(Exception):
    """예산이 남아 있으면 1회 재시도 가능한 실패 (파싱 실패·5xx·거부 등)."""

    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


async def _structured_call(
    *,
    system: str,
    user_content: Any,
    schema: dict,
    model_cls: type[T],
    timeout: float,
    effort: str,
    max_tokens: int,
    label: str,
) -> T:
    started = time.monotonic()
    client = _get_client()
    async with _sem():
        try:
            response = await client.with_options(timeout=timeout).messages.create(
                model=settings.ai_model,
                max_tokens=max_tokens,
                system=[{"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}],
                messages=[{"role": "user", "content": user_content}],
                output_config={"format": {"type": "json_schema", "schema": schema}, "effort": effort},
            )
        except anthropic.APITimeoutError as exc:
            log.warning("%s timeout after %.1fs", label, time.monotonic() - started)
            raise timeout_error() from exc
        except anthropic.RateLimitError as exc:
            raise quota_exceeded() from exc
        except anthropic.APIStatusError as exc:
            if exc.status_code == 429:
                raise quota_exceeded() from exc
            log.warning("%s llm status %s", label, exc.status_code)
            raise LLMCallFailed(f"status_{exc.status_code}") from exc
        except anthropic.APIConnectionError as exc:
            log.warning("%s llm connection error", label)
            raise LLMCallFailed("connection") from exc
        except Exception as exc:
            # SDK 내부 오류·API 키 미설정 등. 500으로 새어나가면 백엔드가 계약대로
            # 폴백(텍스트 입력·데모 모드)할 수 없으므로 계약 오류로 변환한다.
            log.warning("%s llm unexpected %s", label, type(exc).__name__)
            raise LLMCallFailed("unexpected") from exc

    duration = time.monotonic() - started
    usage = getattr(response, "usage", None)
    log.info(
        "%s done in %.2fs in=%s out=%s cached=%s stop=%s",
        label,
        duration,
        getattr(usage, "input_tokens", "?"),
        getattr(usage, "output_tokens", "?"),
        getattr(usage, "cache_read_input_tokens", "?"),
        response.stop_reason,
    )

    if response.stop_reason == "refusal":
        raise LLMCallFailed("refusal")
    if response.stop_reason == "max_tokens":
        raise LLMCallFailed("truncated")

    text = next((block.text for block in response.content if block.type == "text"), None)
    if not text:
        raise LLMCallFailed("no_text_block")
    try:
        return model_cls.model_validate_json(text)
    except ValidationError as exc:
        log.warning("%s schema mismatch", label)
        raise LLMCallFailed("schema_mismatch") from exc


async def _call_with_retry(budget: float, on_fail: ContractError, **kwargs: Any) -> Any:
    started = time.monotonic()
    try:
        return await _structured_call(**kwargs)
    except LLMCallFailed:
        remaining = budget - (time.monotonic() - started)
        if remaining < 2.0:
            raise on_fail
        kwargs["timeout"] = min(kwargs["timeout"], remaining)
        try:
            return await _structured_call(**kwargs)
        except LLMCallFailed as second:
            log.warning("%s failed after retry: %s", kwargs.get("label"), second.code)
            raise on_fail from second


async def extract_structured(user_content: Any) -> prompts.LLMExtraction:
    return await _call_with_retry(
        budget=settings.handler_budget_extract,
        on_fail=extraction_failed("이미지에서 내용을 읽지 못했습니다."),
        system=prompts.EXTRACT_SYSTEM,
        user_content=user_content,
        schema=prompts.EXTRACT_OUTPUT_SCHEMA,
        model_cls=prompts.LLMExtraction,
        timeout=settings.llm_timeout_extract,
        effort=settings.extract_effort,
        max_tokens=8000,
        label="extract",
    )


async def draft_structured(user_text: str) -> prompts.LLMDraft:
    return await _call_with_retry(
        budget=settings.handler_budget_draft,
        on_fail=draft_failed("소명서 문장을 생성하지 못했습니다."),
        system=prompts.DRAFT_SYSTEM,
        user_content=user_text,
        schema=prompts.DRAFT_OUTPUT_SCHEMA,
        model_cls=prompts.LLMDraft,
        timeout=settings.llm_timeout_draft,
        effort=settings.draft_effort,
        max_tokens=8000,
        label="draft",
    )
