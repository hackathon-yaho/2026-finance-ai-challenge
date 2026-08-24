"""데모 세트(F11-03)가 계약 스키마와 어긋나지 않는지 검증한다.

백엔드가 `backend/src/main/resources/demo/`로 복사해 그대로 반환하는 파일이므로,
계약이 바뀌었는데 이 파일이 안 바뀌면 데모 모드만 조용히 낡는다. 그걸 막는 테스트다.
"""

import json
import pathlib

import pytest

from app.schemas.card import ExtractResponse
from app.schemas.draft import DraftResponse
from app.services import factcheck

DEMO = pathlib.Path(__file__).resolve().parents[1] / "demo"
EXTRACTS = sorted(DEMO.glob("extract-*.json"))
DRAFTS = sorted(DEMO.glob("draft-*.json"))


def load(path: pathlib.Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def test_demo_files_exist():
    assert len(EXTRACTS) == 6 and len(DRAFTS) == 3


@pytest.mark.parametrize("path", EXTRACTS, ids=lambda p: p.name)
def test_extract_fixture_matches_contract(path):
    response = ExtractResponse.model_validate(load(path))

    for card in response.cards:
        # 값이 없는 이름의 신뢰도는 null이어야 한다 (계약 "신뢰도의 null")
        if card.counterparty_name is None:
            assert card.field_confidence.counterparty_name is None, card.event_id
        if card.payer_name is None:
            assert card.field_confidence.payer_name is None, card.event_id
        # AI는 카드 간 교차 대조를 하지 않는다 — 항상 false
        assert response.qualityFlags[card.event_id].amount_mismatch is False
        assert card.event_id in response.qualityFlags

    assert response.signals.quality_flags.amount_mismatch is False


@pytest.mark.parametrize("path", DRAFTS, ids=lambda p: p.name)
def test_draft_fixture_matches_contract(path):
    response = DraftResponse.model_validate(load(path))

    assert response.checklist == []
    assert [s.sentenceId for s in response.sentences] == [
        f"s{i}" for i in range(1, len(response.sentences) + 1)
    ]

    for sentence in response.sentences:
        assert sentence.text in response.draftText
        assert sentence.evidenceRefs, sentence.sentenceId
        for ref in sentence.evidenceRefs:
            if ref.type == "evidence":
                assert ref.imageIndex is not None, sentence.sentenceId
            else:
                # intake / user_text는 "본인 진술" 배지 — 이미지 참조를 달지 않는다
                assert ref.imageIndex is None and ref.bbox is None, sentence.sentenceId


@pytest.mark.parametrize("path", DRAFTS, ids=lambda p: p.name)
def test_draft_fixture_has_no_forbidden_phrase(path):
    """실제 파이프라인이 삭제할 문장을 데모가 보여주면 안 된다."""
    for sentence in DraftResponse.model_validate(load(path)).sentences:
        assert factcheck.find_forbidden(sentence.text) is None, sentence.text
