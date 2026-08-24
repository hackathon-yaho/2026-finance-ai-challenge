from app.llm.prompts import LLMDraftSentence
from app.schemas.card import Card, FieldConfidence, SourceRegion
from app.schemas.draft import IntakeFacts
from app.services import factcheck

CONF = FieldConfidence(occurred_at="high", actor="high", amount="high")


def make_card(
    event_id="evt_1_1",
    image_index=1,
    source_type="bank",
    occurred_at="2026-08-19T10:07:00+09:00",
    amount=450000,
):
    return Card(
        event_id=event_id,
        source_image_index=image_index,
        source_type=source_type,
        occurred_at=occurred_at,
        actor="counterparty",
        summary="입금",
        amount=amount,
        field_confidence=CONF,
        source_region=SourceRegion(x=0.1, y=0.2, w=0.5, h=0.1),
    )


def test_extract_dates_variants():
    assert factcheck.extract_dates("2026년 8월 19일 입금") == [(2026, 8, 19)]
    assert factcheck.extract_dates("8월 19일 입금") == [(None, 8, 19)]
    assert factcheck.extract_dates("2026-08-19 기준") == [(2026, 8, 19)]
    assert factcheck.extract_dates("2026년 8월 20일경 인지") == [(2026, 8, 20)]


def test_extract_amounts_variants():
    assert factcheck.extract_amounts("450,000원을 입금") == [450000]
    assert factcheck.extract_amounts("45만원을 입금") == [450000]
    assert factcheck.extract_amounts("500원 이체") == [500]
    assert factcheck.extract_amounts("1,200,000원과 10,000원") == [1200000, 10000]


def test_verify_passes_grounded_sentence():
    facts = factcheck.build_facts([make_card()], None)
    kept, dropped, total = factcheck.verify(
        [LLMDraftSentence(text="2026년 8월 19일 10시 7분 450,000원이 입금되었습니다.", basis=["evt_1_1"])],
        facts,
    )
    assert (len(kept), dropped, total) == (1, 0, 1)
    ref = kept[0].refs[0]
    assert ref.type == "evidence" and ref.imageIndex == 1 and ref.bbox is not None


def test_verify_drops_unfounded_date_tc08():
    facts = factcheck.build_facts([make_card()], None)
    kept, dropped, _ = factcheck.verify(
        [LLMDraftSentence(text="2026년 9월 4일 물품이 도착하였습니다.", basis=["evt_1_1"])],
        facts,
    )
    assert not kept and dropped == 1


def test_verify_drops_wrong_amount():
    facts = factcheck.build_facts([make_card()], None)
    kept, dropped, _ = factcheck.verify(
        [LLMDraftSentence(text="700,000원이 입금되었습니다.", basis=["evt_1_1"])],
        facts,
    )
    assert not kept and dropped == 1


def test_verify_drops_forbidden_and_unknown_basis():
    facts = factcheck.build_facts([make_card()], None)
    kept, dropped, _ = factcheck.verify(
        [
            LLMDraftSentence(text="본 거래는 정상 거래였음을 증명합니다.", basis=["evt_1_1"]),
            LLMDraftSentence(text="근거 없는 문장입니다.", basis=["evt_9_9"]),
            LLMDraftSentence(text="근거가 아예 없습니다.", basis=[]),
        ],
        facts,
    )
    assert not kept and dropped == 3


def test_verify_drops_threat_based_sentence():
    threat = make_card(event_id="evt_2_1", image_index=2, source_type="threat", amount=200000)
    facts = factcheck.build_facts([threat], None)
    kept, dropped, _ = factcheck.verify(
        [LLMDraftSentence(text="협박 메시지를 받았습니다.", basis=["evt_2_1"])],
        facts,
    )
    assert not kept and dropped == 1


def test_verify_drops_past_suspension_history_tc29():
    """history는 전달되지 않지만, 새어나가면 사용자에게 불리하므로 문장 단에서도 막는다."""
    facts = factcheck.build_facts([make_card()], None)
    kept, dropped, _ = factcheck.verify(
        [
            LLMDraftSentence(text="본인은 과거 지급정지된 이력이 있습니다.", basis=["evt_1_1"]),
            LLMDraftSentence(text="이전에도 지급정지를 겪은 바 있습니다.", basis=["evt_1_1"]),
        ],
        facts,
    )
    assert not kept and dropped == 2


def test_verify_drops_amount_evaluation_oi01():
    """'소액' 기준은 은행 내규로 비공개다 — 금액을 평가하는 문장은 삭제한다."""
    facts = factcheck.build_facts([make_card()], None)
    kept, dropped, _ = factcheck.verify(
        [
            LLMDraftSentence(text="450,000원은 소액이므로 문제되지 않습니다.", basis=["evt_1_1"]),
            LLMDraftSentence(text="금액이 크지 않은 거래였습니다.", basis=["evt_1_1"]),
        ],
        facts,
    )
    assert not kept and dropped == 2


def test_verify_drops_name_match_judgment_tc25():
    """이름 대조는 백엔드가 한다. 삼각사기 피해자는 원래 불일치한다."""
    facts = factcheck.build_facts([make_card()], None)
    kept, dropped, _ = factcheck.verify(
        [LLMDraftSentence(text="구매자와 송금인의 이름이 일치하지 않습니다.", basis=["evt_1_1"])],
        facts,
    )
    assert not kept and dropped == 1


def test_verify_keeps_plain_amount_statement():
    """금액 '평가'만 막는다 — 금액을 사실로 적는 문장은 살아남아야 한다."""
    facts = factcheck.build_facts([make_card()], None)
    kept, dropped, _ = factcheck.verify(
        [LLMDraftSentence(text="450,000원이 입금되었습니다.", basis=["evt_1_1"])],
        facts,
    )
    assert len(kept) == 1 and dropped == 0


def test_intake_facts_and_ref_type():
    facts = factcheck.build_facts([], IntakeFacts(when="2026-08-20", amount=450000, kind="goods"))
    kept, dropped, _ = factcheck.verify(
        [LLMDraftSentence(text="2026년 8월 20일경 지급정지 사실을 알게 되었습니다.", basis=["intake:when"])],
        facts,
    )
    assert len(kept) == 1 and dropped == 0
    assert kept[0].refs == [type(kept[0].refs[0])(type="intake")]


def test_user_text_ref_type():
    card = make_card(event_id="evt_txt_1", image_index=None, occurred_at=None, amount=None)
    facts = factcheck.build_facts([card], None)
    kept, _, _ = factcheck.verify(
        [LLMDraftSentence(text="물품 판매 대금을 입금받았습니다.", basis=["evt_txt_1"])],
        facts,
    )
    assert kept[0].refs[0].type == "user_text"


def test_decide_passed_rules():
    facts = factcheck.build_facts([make_card(event_id=f"evt_0_{i}") for i in range(1, 5)], None)
    assert factcheck.decide_passed(4, 0, 4, facts) is True
    assert factcheck.decide_passed(2, 2, 4, facts) is False
    assert factcheck.decide_passed(0, 0, 0, facts) is False

    single = factcheck.build_facts([make_card()], None)
    assert factcheck.decide_passed(1, 0, 1, single) is True

    threat_only = factcheck.build_facts([make_card(source_type="threat")], None)
    assert factcheck.decide_passed(0, 0, 0, threat_only) is True
