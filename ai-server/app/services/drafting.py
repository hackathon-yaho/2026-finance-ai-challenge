"""DraftService — 소명서 본문 생성 + 결정적 검증 + 문장-근거 연결 (design.md §5).

LLM은 본문 사실 문장만 만든다. 협박 수신 문단(F10-04)은 고정 템플릿으로 결정적으로 삽입하고,
factCheckPassed 재시도 드라이브는 계약대로 백엔드가 맡는다(이 서버는 단일 패스·무상태).
"""

import logging
from datetime import datetime

from ..errors import draft_failed
from ..llm import client as llm_client
from ..llm import prompts
from ..schemas.card import Card
from ..schemas.draft import DraftRequest, DraftResponse, EvidenceRef, Sentence
from . import factcheck

log = logging.getLogger("ai.draft")

_SOURCE_LABELS = {
    "chat": "대화 캡처",
    "bank": "입출금 내역",
    "shipping": "배송·운송장",
    "autopay": "자동이체 내역",
    "unknown": "미분류 자료",
}


# 문진 enum을 사람이 읽는 말로 바꾼다. 이 값들이 그대로 나가면 은행에 내는
# 문서에 "거래 성격을 goods로 진술하였습니다" 같은 문장이 실린다 — 실측에서 실제로 나왔다.
_KIND_LABELS = {
    "goods": "물품 판매 대금",
    "service": "용역·근로 제공의 대가",
    "debt": "빌려준 돈의 상환",
    "unclear": "성격을 특정하기 어려운 거래",
}

# api-contract.md: usage = main | occasional | rare
_USAGE_LABELS = {
    "main": "주 거래 계좌로 사용하는 계좌",
    "occasional": "가끔 사용하는 계좌",
    "rare": "거의 사용하지 않는 계좌",
}


def _label(value: str, table: dict[str, str]) -> str | None:
    """모르는 값은 영문 코드를 노출하느니 아예 서술하지 않는다."""
    return table.get(value)


def _format_datetime_kr(occurred_at: str | None) -> str:
    """LLM에게 넘길 일시 표기. ISO를 그대로 주면 문장에 ISO가 그대로 실린다."""
    if not occurred_at:
        return "미상"
    try:
        parsed = datetime.fromisoformat(occurred_at)
    except ValueError:
        return "미상"
    base = f"{parsed.year}년 {parsed.month}월 {parsed.day}일"
    if (parsed.hour, parsed.minute) != (0, 0):
        base += f" {parsed.hour}시 {parsed.minute}분"
    return base


def _format_date_kr(occurred_at: str | None) -> str:
    if occurred_at:
        try:
            parsed = datetime.fromisoformat(occurred_at)
            return f"{parsed.year}년 {parsed.month}월 {parsed.day}일"
        except ValueError:
            pass
    return "일자 미상의 시점에"


def _event_line(event: Card) -> str:
    parts = [f"id={event.event_id}", f"출처={_SOURCE_LABELS.get(event.source_type, event.source_type)}"]
    parts.append(f"일시={_format_datetime_kr(event.occurred_at)}")
    parts.append(f"행위자={event.actor}")
    if event.amount is not None:
        parts.append(f"금액={event.amount:,}원")
    if event.counterparty_name:
        parts.append(f"대화상대 표시명={event.counterparty_name}")
    if event.payer_name:
        parts.append(f"입금자 표기={event.payer_name}")
    if event.identifiers.tracking_no == "MASKED":
        parts.append("운송장=있음(번호 비공개)")
    parts.append(f"내용={event.summary}")
    return "- " + " | ".join(parts)


def _serialize(req: DraftRequest) -> str:
    lines = [
        f"[사유유형] {prompts.REASON_LABELS[req.reason]}",
        f"[준비도 상태] {req.readiness} — 백엔드 규칙 엔진이 이미 결정한 값이다. 재해석·평가하지 마라. "
        "특히 BANK_CHECK_REQUIRED라면 전망·해석 없이 사실만 서술하라.",
        "",
        "[사실 목록]",
    ]
    for event in req.events:
        if event.source_type == "threat":
            continue
        lines.append(_event_line(event))
    if req.intake is not None:
        if req.intake.when:
            lines.append(
                f"- id=intake:when | 출처=문진(본인 진술) | "
                f"지급정지를 알게 된 날={_format_datetime_kr(req.intake.when)}"
            )
        if req.intake.amount is not None:
            lines.append(f"- id=intake:amount | 출처=문진(본인 진술) | 문제가 된 입금액={req.intake.amount:,}원")
        kind_label = _label(req.intake.kind, _KIND_LABELS) if req.intake.kind else None
        if kind_label:
            lines.append(
                f"- id=intake:kind | 출처=문진(본인 진술) | 본인이 밝힌 거래 성격={kind_label}"
            )
        usage_label = _label(req.intake.usage, _USAGE_LABELS) if req.intake.usage else None
        if usage_label:
            lines.append(
                f"- id=intake:usage | 출처=문진(본인 진술) | 계좌 사용 목적={usage_label}"
            )
    lines += [
        "",
        "[지시]",
        "- 위 사실 목록만으로 은행 제출용 사실 진술 문장을 작성하라.",
        "- 날짜·시각은 사실 목록에 적힌 한국어 표기를 그대로 쓴다. "
        "ISO 8601이나 영문 코드를 문장에 넣지 마라 — 사람이 읽는 문서다.",
        "- 시간 순서로, 사실 하나당 한 문장을 기본으로 하되 같은 흐름의 사실은 한 문장으로 묶어도 된다.",
        "- 문장 수는 사실 수를 넘지 않게 하라. 각 문장의 basis에 근거 id를 빠짐없이 넣어라.",
    ]
    return "\n".join(lines)


def _threat_sentence(threat_events: list[Card]) -> tuple[str, list[EvidenceRef]]:
    dated = [e for e in threat_events if e.occurred_at]
    anchor = min(dated, key=lambda e: e.occurred_at) if dated else threat_events[0]
    text = prompts.THREAT_PARAGRAPH_TEMPLATE.format(when=_format_date_kr(anchor.occurred_at))

    refs: list[EvidenceRef] = []
    seen: set[tuple] = set()
    for event in threat_events:
        if event.source_image_index is None:
            key = ("user_text",)
            ref = EvidenceRef(type="user_text")
        else:
            key = ("evidence", event.source_image_index)
            ref = EvidenceRef(type="evidence", imageIndex=event.source_image_index, bbox=event.source_region)
        if key not in seen:
            seen.add(key)
            refs.append(ref)
    return text, refs


async def generate(req: DraftRequest) -> DraftResponse:
    facts = factcheck.build_facts(req.events, req.intake)
    threat_events = [e for e in req.events if e.source_type == "threat"]
    has_non_threat_facts = any(f.source_type != "threat" for f in facts.values())

    if not has_non_threat_facts and not threat_events:
        # intake 계약 확정 전 임시 동작 — docs/request/backend/draft-intake-input.md 회신 대기
        raise draft_failed("소명서에 담을 확인된 사실이 없습니다 (events가 비어 있고 intake도 없음).")

    verified: list[factcheck.VerifiedSentence] = []
    dropped = 0
    total = 0
    if has_non_threat_facts:
        llm_out = await llm_client.draft_structured(_serialize(req))
        verified, dropped, total = factcheck.verify(llm_out.sentences, facts)
        if dropped:
            log.info("factcheck dropped=%d/%d", dropped, total)

    sentences: list[Sentence] = []
    paragraphs: list[str] = []
    for item in verified:
        number = len(sentences) + 1
        sentences.append(Sentence(sentenceId=f"s{number}", text=item.text, evidenceRefs=item.refs))
        paragraphs.append(f"{number}. {item.text}")

    if threat_events:
        text, refs = _threat_sentence(threat_events)
        number = len(sentences) + 1
        sentences.append(Sentence(sentenceId=f"s{number}", text=text, evidenceRefs=refs))
        paragraphs.append(f"{number}. {text}")

    passed = factcheck.decide_passed(len(verified), dropped, total, facts)
    return DraftResponse(
        draftText="\n\n".join(paragraphs),
        sentences=sentences,
        checklist=[],
        factCheckPassed=passed,
    )
