"""ExtractionService — 이미지/텍스트 → 계약 카드 응답 (design.md §3-3·§4).

이미지 바이트는 이 모듈을 벗어나 보관되지 않는다. base64 인코딩 후 원본 참조를 즉시 지운다.
"""

import base64
import logging
from datetime import datetime

from .. import pii
from ..llm import client as llm_client
from ..llm import prompts
from ..schemas.card import (
    Card,
    Recurrence,
    ExtractResponse,
    FieldConfidence,
    Identifiers,
    QualityFlags,
    Signals,
    SourceRegion,
)

log = logging.getLogger("ai.extract")


def _build_recurrence(raw) -> tuple[Recurrence | None, str | None]:
    """LLM이 읽은 개별 발생 일시에서 count·first·last를 **코드가** 만든다.

    LLM이 센 count를 그대로 쓰지 않는다 — "12회"가 사실과 다르면 은행에 가는
    문서의 오류가 된다. 파싱 가능한 일시가 2개 미만이면 반복으로 보지 않는다.

    반환: (recurrence, first_iso) — first_iso는 카드의 occurred_at이 된다.
    """
    if raw is None:
        return None, None
    parsed: list[str] = []
    for value in raw.occurrences:
        try:
            datetime.fromisoformat(value)
        except (TypeError, ValueError):
            continue
        parsed.append(value)
    if len(parsed) < 2:
        # 반복이라 하기에 근거가 부족하다 — 묶지 않는다.
        return None, None
    ordered = sorted(parsed, key=datetime.fromisoformat)

    # 같은 날 안에서 반복된 거래는 정기 거래가 아니다 — 개별 입금 3건을
    # "10,000원 3회"로 묶으면 소명에 필요한 개별 사실이 사라진다.
    # 평가 세트 ev-bank-02(1분 간격 입금 3건)가 묶이는 것을 보고 넣었다.
    span = datetime.fromisoformat(ordered[-1]) - datetime.fromisoformat(ordered[0])
    if span.days < 1:
        return None, None

    return (
        Recurrence(count=len(ordered), period=raw.period, first=ordered[0], last=ordered[-1]),
        ordered[0],
    )


def _to_cards(
    out: prompts.LLMExtraction,
    image_index: int | None,
    id_prefix: str,
    force_low_time: bool,
) -> tuple[list[Card], dict[str, QualityFlags]]:
    cards: list[Card] = []
    quality: dict[str, QualityFlags] = {}
    pii_hits = 0

    for i, event in enumerate(out.events, start=1):
        event_id = f"{id_prefix}{i}"

        summary, hits = pii.scrub_text(event.summary)
        pii_hits += hits
        counterparty_name, hits = pii.scrub_name(event.counterparty_name)
        pii_hits += hits
        counterparty_name, hits = pii.clean_name_field(counterparty_name)
        pii_hits += hits
        payer_name, hits = pii.scrub_name(event.payer_name)
        pii_hits += hits
        payer_name, hits = pii.clean_name_field(payer_name)
        pii_hits += hits

        recurrence, first_iso = _build_recurrence(getattr(event, "recurrence", None))
        occurred_at = first_iso or event.occurred_at

        # 흐리다고 **스스로 표기한** 카드의 신뢰도는 low로 내린다.
        # 실측에서 심한 흐림에 틀린 값(김인훈/40000)을 medium으로 낸 일이 반복됐다.
        # 프롬프트로 "자신 없으면 low"를 시키는 것은 확률적이라 불변식이 되지 않는다.
        # low는 FR-028에서 사용자 확인을 강제하므로, 과하게 확인받는 쪽이
        # 틀린 값이 조용히 통과하는 것보다 낫다 ("확인 전 오류 차단률 100%").
        def _cap(level: str | None) -> str | None:
            if level is None:
                return None
            return "low" if event.blurry else level

        # 값이 없는 이름의 신뢰도는 버린다 — LLM이 뭘 매겼든 null이 계약값이다.
        confidence = FieldConfidence(
            occurred_at="low" if force_low_time else _cap(event.confidence.occurred_at),
            actor=_cap(event.confidence.actor),
            amount=_cap(event.confidence.amount),
            counterparty_name=_cap(event.confidence.counterparty_name) if counterparty_name else None,
            payer_name=_cap(event.confidence.payer_name) if payer_name else None,
        )
        region = None
        if event.source_region is not None and not force_low_time:
            region = SourceRegion(**event.source_region.model_dump())

        cards.append(
            Card(
                event_id=event_id,
                source_image_index=image_index,
                source_type=event.source_type,
                occurred_at=occurred_at,
                actor=event.actor,
                summary=summary or "",
                # 부호는 계약상 항상 양수다 — 방향은 source_type·actor·summary가 나타낸다.
                amount=abs(event.amount) if event.amount is not None else None,
                counterparty_name=counterparty_name,
                payer_name=payer_name,
                recurrence=recurrence,
                identifiers=Identifiers(
                    tracking_no="MASKED" if event.tracking_no_present else None,
                    account_last4=pii.clean_account_last4(event.account_last4),
                ),
                field_confidence=confidence,
                source_region=region,
            )
        )
        quality[event_id] = QualityFlags(
            blurry=event.blurry, missing_date=event.missing_date, amount_mismatch=False
        )

    if pii_hits:
        log.info("pii scrubbed fields=%d", pii_hits)
    return cards, quality


def _signals(out: prompts.LLMExtraction, quality: dict[str, QualityFlags]) -> Signals:
    return Signals(
        threat_detected=out.threat_detected,
        delivery_evidence=out.delivery_evidence,
        life_activity=out.life_activity,
        quality_flags=QualityFlags(
            blurry=any(flag.blurry for flag in quality.values()),
            missing_date=any(flag.missing_date for flag in quality.values()),
            amount_mismatch=False,
        ),
    )


async def extract_image(data: bytes, media_type: str, image_index: int) -> ExtractResponse:
    encoded = base64.standard_b64encode(data).decode("ascii")
    del data

    content = llm_client.image_content(encoded, media_type)
    try:
        out = await llm_client.extract_structured(content)
    finally:
        del content, encoded

    if out.injection_suspected:
        log.info("injection_suspected image_index=%d", image_index)

    cards, quality = _to_cards(out, image_index, f"evt_{image_index}_", force_low_time=False)
    return ExtractResponse(cards=cards, signals=_signals(out, quality), qualityFlags=quality)


async def extract_text(raw_text: str) -> ExtractResponse:
    content = (
        prompts.EXTRACT_TEXT_INSTRUCTION
        + "\n\n----- 사용자 서술 시작 -----\n"
        + raw_text
        + "\n----- 사용자 서술 끝 -----"
    )
    out = await llm_client.extract_structured(llm_client.text_content(content), is_text=True)

    if out.injection_suspected:
        log.info("injection_suspected source=text")

    cards, quality = _to_cards(out, None, "evt_txt_", force_low_time=True)
    return ExtractResponse(cards=cards, signals=_signals(out, quality), qualityFlags=quality)
