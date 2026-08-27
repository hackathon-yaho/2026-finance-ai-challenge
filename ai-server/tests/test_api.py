import pytest

from tests.conftest import AUTH

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32


def fake_extract_response():
    from app.schemas.card import ExtractResponse, QualityFlags, Signals

    return ExtractResponse(cards=[], signals=Signals(), qualityFlags={})


def test_health_is_public(client):
    response = client.get("/internal/health")
    assert response.status_code == 200
    assert response.json() == {"status": "UP"}


def test_extract_requires_token(client):
    response = client.post("/internal/extract?image_index=0", content=PNG, headers={"Content-Type": "image/png"})
    assert response.status_code == 401
    assert response.json()["error"] == "UNAUTHORIZED"


def test_extract_rejects_wrong_token(client):
    response = client.post(
        "/internal/extract?image_index=0",
        content=PNG,
        headers={"Content-Type": "image/png", "X-Internal-Token": "wrong"},
    )
    assert response.status_code == 401


def test_extract_requires_image_index(client):
    response = client.post("/internal/extract", content=PNG, headers={"Content-Type": "image/png", **AUTH})
    assert response.status_code == 400


def test_extract_rejects_bad_magic_bytes(client):
    response = client.post(
        "/internal/extract?image_index=0",
        content=b"not-an-image-at-all",
        headers={"Content-Type": "image/png", **AUTH},
    )
    assert response.status_code == 400


def test_extract_rejects_unknown_content_type(client):
    response = client.post(
        "/internal/extract?image_index=0",
        content=b"data",
        headers={"Content-Type": "application/octet-stream", **AUTH},
    )
    assert response.status_code == 400


def test_extract_image_happy_path(client, monkeypatch):
    from app.services import extraction

    async def fake(data, media_type, image_index, reference_date=None, intake_when=None):
        assert data.startswith(b"\x89PNG")
        assert media_type == "image/png"
        assert image_index == 3
        # 쿼리로 받은 기준 시점이 서비스까지 전달돼야 한다 (계약 2026-08-27)
        assert reference_date == "2026-08-27"
        return fake_extract_response()

    monkeypatch.setattr(extraction, "extract_image", fake)
    response = client.post(
        "/internal/extract?image_index=3&reference_date=2026-08-27",
        content=PNG,
        headers={"Content-Type": "image/png", **AUTH},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["cards"] == []
    assert body["signals"]["quality_flags"]["amount_mismatch"] is False
    assert body["qualityFlags"] == {}


def test_extract_text_path(client, monkeypatch):
    from app.services import extraction

    async def fake(raw_text):
        assert raw_text == "당근에서 아이패드를 팔았습니다"
        return fake_extract_response()

    monkeypatch.setattr(extraction, "extract_text", fake)
    response = client.post(
        "/internal/extract",
        json={"rawText": "당근에서 아이패드를 팔았습니다"},
        headers=AUTH,
    )
    assert response.status_code == 200


def test_extract_text_rejects_over_2000_chars(client):
    response = client.post("/internal/extract", json={"rawText": "가" * 2001}, headers=AUTH)
    assert response.status_code == 400


def test_draft_rejects_invalid_body(client):
    response = client.post("/internal/draft", json={"events": [], "reason": "invalid"}, headers=AUTH)
    assert response.status_code == 400
    assert response.json()["error"] == "BAD_REQUEST"


@pytest.fixture()
def bank_event():
    return {
        "event_id": "evt_1_1",
        "source_image_index": 1,
        "source_type": "bank",
        "occurred_at": "2026-08-19T10:07:00+09:00",
        "actor": "counterparty",
        "summary": "물품대금 450,000원 입금",
        "amount": 450000,
        "payer_name": "김민준",
        "field_confidence": {"occurred_at": "high", "actor": "high", "amount": "high"},
        "source_region": {"x": 0.06, "y": 0.31, "w": 0.88, "h": 0.14},
        "confirmation_status": "user_confirmed",
    }


def test_draft_pipeline_verifies_and_links(client, monkeypatch, bank_event):
    from app.llm import client as llm_client
    from app.llm.prompts import LLMDraft, LLMDraftSentence

    async def fake(user_text):
        assert "evt_1_1" in user_text
        return LLMDraft(
            sentences=[
                LLMDraftSentence(
                    text="2026년 8월 19일 10시 7분 물품대금 450,000원이 입금되었습니다.",
                    basis=["evt_1_1"],
                ),
                LLMDraftSentence(text="2026년 9월 4일 수령을 확인하였습니다.", basis=["evt_1_1"]),
            ]
        )

    monkeypatch.setattr(llm_client, "draft_structured", fake)
    response = client.post(
        "/internal/draft",
        json={"events": [bank_event], "reason": "goods", "readiness": "SUBMISSION_READY"},
        headers=AUTH,
    )
    assert response.status_code == 200
    body = response.json()
    assert len(body["sentences"]) == 1
    assert "9월 4일" not in body["draftText"]
    assert body["sentences"][0]["evidenceRefs"][0] == {
        "type": "evidence",
        "imageIndex": 1,
        "bbox": {"x": 0.06, "y": 0.31, "w": 0.88, "h": 0.14},
    }
    assert body["checklist"] == []
    assert body["factCheckPassed"] is False


def test_draft_threat_paragraph_is_deterministic(client, bank_event):
    threat_event = dict(
        bank_event,
        event_id="evt_2_1",
        source_image_index=2,
        source_type="threat",
        occurred_at="2026-08-22T09:14:00+09:00",
        amount=200000,
        payer_name=None,
    )
    response = client.post(
        "/internal/draft",
        json={"events": [threat_event], "reason": "goods", "readiness": "SUBMISSION_READY"},
        headers=AUTH,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["factCheckPassed"] is True
    assert len(body["sentences"]) == 1
    assert "2026년 8월 22일" in body["sentences"][0]["text"]
    assert "금전을 요구하는 메시지를 수신한 사실" in body["sentences"][0]["text"]


def test_draft_intake_only_marks_own_statement(client, monkeypatch):
    from app.llm import client as llm_client
    from app.llm.prompts import LLMDraft, LLMDraftSentence

    async def fake(user_text):
        return LLMDraft(
            sentences=[
                LLMDraftSentence(text="2026년 8월 20일경 지급정지 사실을 알게 되었습니다.", basis=["intake:when"]),
                LLMDraftSentence(text="문제가 된 450,000원은 물품 판매 대금으로 받은 것입니다.", basis=["intake:amount", "intake:kind"]),
                LLMDraftSentence(text="해당 계좌는 주 거래 계좌로 사용하고 있습니다.", basis=["intake:usage"]),
            ]
        )

    monkeypatch.setattr(llm_client, "draft_structured", fake)
    response = client.post(
        "/internal/draft",
        json={
            "events": [],
            "reason": "goods",
            "readiness": "SUPPLEMENT_NEEDED",
            "intake": {"when": "2026-08-20", "amount": 450000, "kind": "goods", "usage": "main"},
        },
        headers=AUTH,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["factCheckPassed"] is True
    assert all(s["evidenceRefs"] == [{"type": "intake"}] for s in body["sentences"])


def test_draft_without_any_facts_fails(client):
    response = client.post(
        "/internal/draft",
        json={"events": [], "reason": "goods", "readiness": "SUPPLEMENT_NEEDED"},
        headers=AUTH,
    )
    assert response.status_code == 502
    assert response.json()["error"] == "DRAFT_FAILED"


def test_missing_llm_key_is_config_error_not_extraction_failed(client, monkeypatch):
    """설정 오류를 판독 실패로 감싸면 사용자를 텍스트 입력으로 보내는데 해결되지 않는다.

    프론트가 로컬 연동에서 발견 (docs/request/ai/llm-provider-mismatch.md).
    """
    from app.llm import client as llm_client

    monkeypatch.setattr(llm_client, "api_key_present", lambda: False)

    calls = []
    monkeypatch.setattr(
        llm_client, "_structured_call", lambda **kw: calls.append(kw)
    )

    response = client.post(
        "/internal/extract", json={"rawText": "9월 1일 30만원 입금"}, headers=AUTH
    )
    assert response.status_code == 500
    body = response.json()
    assert body["error"] == "AI_CONFIG_ERROR"
    assert "fallback" not in body  # 텍스트 입력으로 유도하지 않는다
    assert calls == []  # 재시도는커녕 호출조차 하지 않는다


def test_text_path_failure_has_no_text_input_fallback(client, monkeypatch):
    """이미 텍스트로 보낸 요청에 '텍스트로 입력하세요'를 주면 같은 자리를 맴돈다."""
    from app.llm import client as llm_client

    monkeypatch.setattr(llm_client, "api_key_present", lambda: True)

    async def boom(**_kwargs):
        raise llm_client.LLMCallFailed("schema_mismatch")

    monkeypatch.setattr(llm_client, "_structured_call", boom)

    response = client.post(
        "/internal/extract", json={"rawText": "9월 1일 30만원 입금"}, headers=AUTH
    )
    assert response.status_code == 502
    body = response.json()
    assert body["error"] == "EXTRACTION_FAILED"
    assert "fallback" not in body
    assert "이미지" not in body["message"]


def test_image_path_failure_keeps_text_input_fallback(client, monkeypatch):
    from app.llm import client as llm_client

    monkeypatch.setattr(llm_client, "api_key_present", lambda: True)

    async def boom(**_kwargs):
        raise llm_client.LLMCallFailed("schema_mismatch")

    monkeypatch.setattr(llm_client, "_structured_call", boom)

    response = client.post(
        "/internal/extract?image_index=0",
        content=PNG,
        headers={"Content-Type": "image/png", **AUTH},
    )
    assert response.status_code == 502
    assert response.json()["fallback"] == "text_input"
