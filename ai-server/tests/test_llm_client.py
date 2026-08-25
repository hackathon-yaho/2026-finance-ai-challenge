"""LLM 계층의 실패가 계약 오류로 나가는지 검증한다.

500으로 새어나가면 백엔드가 계약대로 폴백(텍스트 입력 전환·데모 모드)할 수 없다.
"""

import pytest

from app.errors import ContractError
from app.llm import client


class Boom:
    """어떤 호출이든 예상 못 한 예외를 던지는 가짜 SDK 클라이언트."""

    def __init__(self, exc: Exception):
        self._exc = exc

    def with_options(self, **_kwargs):
        raise self._exc


@pytest.fixture(autouse=True)
def _key_present(monkeypatch):
    """키 유무 점검을 통과시켜, SDK 오류 매핑 자체를 검증한다."""
    monkeypatch.setattr(client, "api_key_present", lambda: True)


@pytest.fixture()
def broken_client(monkeypatch):
    def install(exc: Exception):
        monkeypatch.setattr(client, "_get_client", lambda: Boom(exc))

    return install


@pytest.mark.anyio
async def test_missing_api_key_becomes_extraction_failed(broken_client):
    """API 키가 없으면 SDK가 요청 시점에 터진다 — 500이 아니라 계약 오류여야 한다."""
    broken_client(TypeError("api_key must be set"))
    with pytest.raises(ContractError) as caught:
        await client.extract_structured([{"type": "text", "text": "x"}])
    assert caught.value.status_code == 502
    assert caught.value.error == "EXTRACTION_FAILED"
    assert caught.value.fallback == "text_input"


@pytest.mark.anyio
async def test_unexpected_sdk_error_becomes_draft_failed(broken_client):
    broken_client(RuntimeError("something inside the sdk"))
    with pytest.raises(ContractError) as caught:
        await client.draft_structured("사실 목록")
    assert caught.value.status_code == 502
    assert caught.value.error == "DRAFT_FAILED"


@pytest.fixture()
def anyio_backend():
    return "asyncio"
