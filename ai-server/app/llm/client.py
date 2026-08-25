"""LLM 호출 래퍼 — 공급자 SDK를 감싸고, 오류를 계약 코드로 매핑한다.

**공급자 의존은 이 파일 하나에 가둔다.** 이미지·텍스트 콘텐츠 블록을 만드는
것도 여기서 한다 — 서비스 계층(`services/extraction.py`)은 공급자 형식을
알지 못한다. 공급자를 바꿀 때 고칠 파일이 하나여야 하기 때문이다.

공급자: OpenAI (2026-08-26 확정). Responses API + `text_format`(pydantic)으로
structured output을 받는다 — 손으로 쓴 JSON 스키마를 따로 두지 않으므로
스키마가 두 곳에서 어긋날 일이 없다.

로그에는 소요 시간·토큰 수·실패 사유 코드만 남긴다. 이미지·추출 텍스트·
LLM 원문은 남기지 않는다(NFR-08).
"""

import asyncio
import logging
import os
import time
from typing import Any, TypeVar

import openai
from openai import AsyncOpenAI
from pydantic import BaseModel

from ..config import settings
from ..errors import (
    ContractError,
    config_error,
    draft_failed,
    extraction_failed,
    quota_exceeded,
    timeout_error,
)
from . import prompts

log = logging.getLogger("ai.llm")

API_KEY_ENV = "OPENAI_API_KEY"

_client: AsyncOpenAI | None = None
_semaphore: asyncio.Semaphore | None = None

T = TypeVar("T", bound=BaseModel)


def api_key_present() -> bool:
    """LLM API 키가 설정돼 있는가. 기동 로그와 호출 전 점검에서 함께 쓴다."""
    return bool(os.environ.get(API_KEY_ENV, "").strip())


def _get_client() -> AsyncOpenAI:
    """지연 생성. 임포트 시점에 만들면 키가 없을 때 서버가 아예 뜨지 못한다.

    배포는 LLM 키 확정보다 먼저 이루어질 수 있어야 한다 — 키가 없어도
    `/internal/health`는 200을 돌려주고, LLM 경로만 계약 오류로 실패한다.
    """
    global _client
    if _client is None:
        _client = AsyncOpenAI(max_retries=0)
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


# ── 공급자별 콘텐츠 블록 (밖으로 새지 않게 여기서만 만든다) ──────────────


def image_content(encoded: str, media_type: str) -> list[dict]:
    """base64 이미지 + 지시문. 원본 바이트는 호출자가 즉시 폐기한다."""
    return [
        {"type": "input_image", "image_url": f"data:{media_type};base64,{encoded}", "detail": "high"},
        {"type": "input_text", "text": prompts.EXTRACT_IMAGE_INSTRUCTION},
    ]


def text_content(body: str) -> list[dict]:
    return [{"type": "input_text", "text": body}]


async def _structured_call(
    *,
    system: str,
    user_content: Any,
    model_cls: type[T],
    timeout: float,
    effort: str,
    max_tokens: int,
    label: str,
    model: str,
    fallback: bool = True,
) -> T:
    started = time.monotonic()
    client = _get_client()
    async with _sem():
        try:
            response = await client.with_options(timeout=timeout).responses.parse(
                model=model,
                input=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user_content},
                ],
                text_format=model_cls,
                reasoning={"effort": effort},
                max_output_tokens=max_tokens,
            )
        except openai.APITimeoutError as exc:
            log.warning("%s timeout after %.1fs", label, time.monotonic() - started)
            raise timeout_error(fallback=fallback) from exc
        except openai.RateLimitError as exc:
            raise quota_exceeded() from exc
        except (openai.AuthenticationError, openai.PermissionDeniedError) as exc:
            # 키가 틀렸거나 권한이 없다 — 다시 불러도 같다. 설정 오류로 분리한다.
            log.error("%s llm auth failed (%s) — 설정 확인 필요", label, type(exc).__name__)
            raise config_error() from exc
        except openai.APIStatusError as exc:
            if exc.status_code == 429:
                raise quota_exceeded() from exc
            log.warning("%s llm status %s", label, exc.status_code)
            raise LLMCallFailed(f"status_{exc.status_code}") from exc
        except openai.APIConnectionError as exc:
            log.warning("%s llm connection error", label)
            raise LLMCallFailed("connection") from exc
        except Exception as exc:
            # SDK 내부 오류 등. 500으로 새어나가면 백엔드가 계약대로 폴백할 수 없다.
            log.warning("%s llm unexpected %s", label, type(exc).__name__)
            raise LLMCallFailed("unexpected") from exc

    usage = getattr(response, "usage", None)
    log.info(
        "%s done in %.2fs in=%s out=%s cached=%s status=%s",
        label,
        time.monotonic() - started,
        getattr(usage, "input_tokens", "?"),
        getattr(usage, "output_tokens", "?"),
        getattr(getattr(usage, "input_tokens_details", None), "cached_tokens", "?"),
        getattr(response, "status", "?"),
    )

    if getattr(response, "status", None) == "incomplete":
        reason = getattr(getattr(response, "incomplete_details", None), "reason", "unknown")
        raise LLMCallFailed(f"incomplete_{reason}")

    parsed = getattr(response, "output_parsed", None)
    if parsed is None:
        # 안전 거부이거나 스키마에 맞는 출력을 내지 못한 경우
        log.warning("%s no parsed output", label)
        raise LLMCallFailed("no_parsed_output")
    return parsed


async def _call_with_retry(budget: float, on_fail: ContractError, **kwargs: Any) -> Any:
    if not api_key_present():
        # 재시도해도 결과가 같다. 판독 실패로 감싸면 사용자가 텍스트 입력으로
        # 보내지는데 그래도 해결되지 않는다 (계약 AI_CONFIG_ERROR 절).
        log.error(
            "%s %s가 설정되지 않았습니다 — set-key.ps1 또는 Secret Manager 확인",
            kwargs.get("label"),
            API_KEY_ENV,
        )
        raise config_error()

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


async def extract_structured(user_content: Any, *, is_text: bool = False) -> prompts.LLMExtraction:
    """is_text이면 실패 메시지에서 '이미지'를 빼고 fallback도 주지 않는다.

    텍스트로 보낸 요청에 "텍스트로 입력하세요"를 대안으로 주면 같은 자리를 맴돈다.
    """
    message = (
        "입력하신 내용에서 거래 정보를 찾지 못했습니다."
        if is_text
        else "이미지에서 내용을 읽지 못했습니다."
    )
    return await _call_with_retry(
        budget=settings.handler_budget_extract,
        on_fail=extraction_failed(message, fallback=not is_text),
        system=prompts.EXTRACT_SYSTEM,
        user_content=user_content,
        model_cls=prompts.LLMExtraction,
        timeout=settings.llm_timeout_extract,
        effort=settings.extract_effort,
        max_tokens=8000,
        label="extract-text" if is_text else "extract",
        model=settings.ai_model,
        fallback=not is_text,
    )


async def draft_structured(user_text: str) -> prompts.LLMDraft:
    return await _call_with_retry(
        budget=settings.handler_budget_draft,
        on_fail=draft_failed("소명서 문장을 생성하지 못했습니다."),
        system=prompts.DRAFT_SYSTEM,
        user_content=text_content(user_text),
        model_cls=prompts.LLMDraft,
        timeout=settings.llm_timeout_draft,
        effort=settings.draft_effort,
        max_tokens=8000,
        label="draft",
        model=settings.draft_model,
        fallback=False,
    )
