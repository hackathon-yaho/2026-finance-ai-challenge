"""_to_cards의 결정적 후처리 검증 (LLM 호출 없음)."""

from app.llm.prompts import LLMEvent, LLMEventConfidence, LLMExtraction
from app.services import extraction

ALL_HIGH = LLMEventConfidence(
    occurred_at="high", actor="high", amount="high", counterparty_name="high", payer_name="high"
)


def make_event(counterparty_name=None, payer_name=None, **kwargs):
    defaults = dict(
        occurred_at="2026-08-19T10:07:00+09:00",
        actor="counterparty",
        summary="물품대금 450,000원 입금",
        amount=450000,
        source_type="bank",
        tracking_no_present=False,
        account_last4=None,
        confidence=ALL_HIGH,
        source_region=None,
        blurry=False,
        missing_date=False,
    )
    defaults.update(kwargs)
    return LLMEvent(counterparty_name=counterparty_name, payer_name=payer_name, **defaults)


def to_cards(event, force_low_time=False):
    out = LLMExtraction(
        events=[event],
        threat_detected=False,
        delivery_evidence=False,
        life_activity=False,
        injection_suspected=False,
    )
    cards, _ = extraction._to_cards(out, 1, "evt_1_", force_low_time=force_low_time)
    return cards[0]


def test_missing_name_nulls_its_confidence():
    """LLM이 high를 매겨도 이름이 없으면 신뢰도는 null이다 (계약 "신뢰도의 null" 절)."""
    card = to_cards(make_event(counterparty_name=None, payer_name=None))
    assert card.field_confidence.counterparty_name is None
    assert card.field_confidence.payer_name is None
    # 값이 있는 필드의 신뢰도는 그대로 유지된다
    assert card.field_confidence.occurred_at == "high"
    assert card.field_confidence.amount == "high"


def test_present_name_keeps_its_confidence():
    card = to_cards(make_event(payer_name="김민준"))
    assert card.payer_name == "김민준"
    assert card.field_confidence.payer_name == "high"
    assert card.field_confidence.counterparty_name is None


def test_name_scrubbed_by_pii_also_nulls_confidence():
    """전화번호가 이름 자리에 들어오면 pii가 null로 만들고, 신뢰도도 함께 사라진다."""
    card = to_cards(make_event(counterparty_name="010-1234-5678"))
    assert card.counterparty_name is None
    assert card.field_confidence.counterparty_name is None


def test_text_path_forces_low_time_confidence():
    card = to_cards(make_event(payer_name="김민준"), force_low_time=True)
    assert card.field_confidence.occurred_at == "low"
    assert card.source_region is None
