"""FactChecker — FR-045의 결정적 사실 검증기. LLM을 사용하지 않는 순수 함수만 둔다 (design.md §5-2).

문장 속 날짜·시각·금액이 basis로 지목된 사실에 실제로 존재하는지 대조하고,
결론·예측 표현을 차단하며, 근거 유형(evidence/intake/user_text)을 판정한다.
"""

import re
from dataclasses import dataclass
from datetime import datetime

from ..llm.prompts import LLMDraftSentence
from ..schemas.card import Card, SourceRegion
from ..schemas.draft import EvidenceRef, IntakeFacts

FORBIDDEN_PHRASES = [
    "결백", "반증", "혐의가 없", "죄가 없", "무고함",
    "정상 거래", "정상거래", "정상 판매", "정상적인 거래", "피해자와 무관", "무관합니다", "무관함",
    "기각", "승인될", "승인 가능", "해제될", "해제 가능", "해볼 만", "해볼만",
    "선처", "간곡", "억울", "호소",
    "배송 완료", "배송이 완료", "배송을 완료", "수령을 확인", "수령하였", "수령했", "수령 완료",
    "편취 의도", "증명합니다", "증명한다", "입증합니다", "입증한다",
    "명백합니다", "명백히", "분명합니다", "확실합니다", "틀림없",
]

_DATE_FULL = re.compile(r"(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일")
_DATE_ISO = re.compile(r"(\d{4})-(\d{2})-(\d{2})")
_DATE_MD = re.compile(r"(?<![\d\-])(\d{1,2})\s*월\s*(\d{1,2})\s*일")
_TIME_HM = re.compile(r"(\d{1,2})\s*시\s*(\d{1,2})\s*분")
_AMOUNT_COMMA = re.compile(r"(\d{1,3}(?:,\d{3})+)\s*원")
_AMOUNT_MAN = re.compile(r"(\d+(?:\.\d+)?)\s*만\s*원")
_AMOUNT_PLAIN = re.compile(r"(?<![\d,.])(\d{2,})\s*원")


@dataclass(frozen=True)
class Fact:
    fact_id: str
    ref_type: str  # evidence | user_text | intake
    image_index: int | None
    bbox: SourceRegion | None
    date: tuple[int, int, int] | None
    hm: tuple[int, int] | None
    amount: int | None
    source_type: str | None


def _parse_when(value: str | None) -> tuple[tuple[int, int, int] | None, tuple[int, int] | None]:
    if not value:
        return None, None
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError:
        try:
            parsed = datetime.strptime(value, "%Y-%m-%d")
        except ValueError:
            return None, None
    date = (parsed.year, parsed.month, parsed.day)
    hm = (parsed.hour, parsed.minute) if (parsed.hour, parsed.minute, parsed.second) != (0, 0, 0) else None
    return date, hm


def build_facts(events: list[Card], intake: IntakeFacts | None) -> dict[str, Fact]:
    facts: dict[str, Fact] = {}
    for event in events:
        date, hm = _parse_when(event.occurred_at)
        ref_type = "user_text" if event.source_image_index is None else "evidence"
        facts[event.event_id] = Fact(
            fact_id=event.event_id,
            ref_type=ref_type,
            image_index=event.source_image_index,
            bbox=event.source_region,
            date=date,
            hm=hm,
            amount=event.amount,
            source_type=event.source_type,
        )
    if intake is not None:
        if intake.when:
            date, _ = _parse_when(intake.when)
            facts["intake:when"] = Fact("intake:when", "intake", None, None, date, None, None, None)
        if intake.amount is not None:
            facts["intake:amount"] = Fact("intake:amount", "intake", None, None, None, None, intake.amount, None)
        if intake.kind:
            facts["intake:kind"] = Fact("intake:kind", "intake", None, None, None, None, None, None)
        if intake.usage:
            facts["intake:usage"] = Fact("intake:usage", "intake", None, None, None, None, None, None)
    return facts


def _blank(text: str, spans: list[tuple[int, int]]) -> str:
    chars = list(text)
    for start, end in spans:
        for i in range(start, end):
            chars[i] = " "
    return "".join(chars)


def extract_dates(text: str) -> list[tuple[int | None, int, int]]:
    dates: list[tuple[int | None, int, int]] = []
    spans: list[tuple[int, int]] = []
    for match in _DATE_FULL.finditer(text):
        dates.append((int(match.group(1)), int(match.group(2)), int(match.group(3))))
        spans.append(match.span())
    work = _blank(text, spans)
    for match in _DATE_ISO.finditer(work):
        dates.append((int(match.group(1)), int(match.group(2)), int(match.group(3))))
    work = _blank(work, [m.span() for m in _DATE_ISO.finditer(work)])
    for match in _DATE_MD.finditer(work):
        dates.append((None, int(match.group(1)), int(match.group(2))))
    return dates


def extract_times(text: str) -> list[tuple[int, int]]:
    return [(int(m.group(1)), int(m.group(2))) for m in _TIME_HM.finditer(text)]


def extract_amounts(text: str) -> list[int]:
    amounts: list[int] = []
    spans: list[tuple[int, int]] = []
    for match in _AMOUNT_COMMA.finditer(text):
        amounts.append(int(match.group(1).replace(",", "")))
        spans.append(match.span())
    work = _blank(text, spans)
    for match in _AMOUNT_MAN.finditer(work):
        amounts.append(int(float(match.group(1)) * 10000))
    work = _blank(work, [m.span() for m in _AMOUNT_MAN.finditer(work)])
    for match in _AMOUNT_PLAIN.finditer(work):
        amounts.append(int(match.group(1)))
    return amounts


def find_forbidden(text: str) -> str | None:
    for phrase in FORBIDDEN_PHRASES:
        if phrase in text:
            return phrase
    return None


@dataclass
class VerifiedSentence:
    text: str
    refs: list[EvidenceRef]


def _refs_for(basis_facts: list[Fact]) -> list[EvidenceRef]:
    refs: list[EvidenceRef] = []
    seen: set[tuple] = set()
    for fact in basis_facts:
        if fact.ref_type == "evidence":
            key = ("evidence", fact.image_index)
            ref = EvidenceRef(type="evidence", imageIndex=fact.image_index, bbox=fact.bbox)
        else:
            key = (fact.ref_type,)
            ref = EvidenceRef(type=fact.ref_type)  # type: ignore[arg-type]
        if key not in seen:
            seen.add(key)
            refs.append(ref)
    return refs


def verify(
    sentences: list[LLMDraftSentence], facts: dict[str, Fact]
) -> tuple[list[VerifiedSentence], int, int]:
    kept: list[VerifiedSentence] = []
    dropped = 0

    for sentence in sentences:
        text = sentence.text.strip()
        if not text or not sentence.basis:
            dropped += 1
            continue

        basis_facts = [facts[b] for b in sentence.basis if b in facts]
        if len(basis_facts) != len(sentence.basis):
            dropped += 1
            continue
        if any(fact.source_type == "threat" for fact in basis_facts):
            dropped += 1
            continue
        if find_forbidden(text):
            dropped += 1
            continue

        fact_dates = {fact.date for fact in basis_facts if fact.date}
        fact_md = {(d[1], d[2]) for d in fact_dates}
        if any(
            (year is not None and (year, month, day) not in fact_dates)
            or (year is None and (month, day) not in fact_md)
            for year, month, day in extract_dates(text)
        ):
            dropped += 1
            continue

        fact_times = {fact.hm for fact in basis_facts if fact.hm}
        if any(hm not in fact_times for hm in extract_times(text)):
            dropped += 1
            continue

        fact_amounts = {fact.amount for fact in basis_facts if fact.amount is not None}
        if any(amount not in fact_amounts for amount in extract_amounts(text)):
            dropped += 1
            continue

        kept.append(VerifiedSentence(text=text, refs=_refs_for(basis_facts)))

    return kept, dropped, len(sentences)


def decide_passed(kept_count: int, dropped: int, total: int, facts: dict[str, Fact]) -> bool:
    non_threat = [fact for fact in facts.values() if fact.source_type != "threat"]
    if not non_threat:
        return True
    if total == 0 or kept_count == 0:
        return False
    if dropped * 3 >= total:
        return False
    return kept_count >= min(3, len(non_threat))
