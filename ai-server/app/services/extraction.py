"""ExtractionService — 이미지/텍스트 → 계약 카드 응답 (design.md §3-3·§4).

이미지 바이트는 이 모듈을 벗어나 보관되지 않는다. base64 인코딩 후 원본 참조를 즉시 지운다.
"""

import base64
import logging

from .. import pii
from ..llm import client as llm_client
from ..llm import prompts
from ..schemas.card import (
    Card,
    ExtractResponse,
    FieldConfidence,
    Identifiers,
    QualityFlags,
    Signals,
    SourceRegion,
)

log = logging.getLogger("ai.extract")


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

        # 값이 없는 이름의 신뢰도는 버린다 — LLM이 뭘 매겼든 null이 계약값이다.
        confidence = FieldConfidence(
            occurred_at="low" if force_low_time else event.confidence.occurred_at,
            actor=event.confidence.actor,
            amount=event.confidence.amount,
            counterparty_name=event.confidence.counterparty_name if counterparty_name else None,
            payer_name=event.confidence.payer_name if payer_name else None,
        )
        region = None
        if event.source_region is not None and not force_low_time:
            region = SourceRegion(**event.source_region.model_dump())

        cards.append(
            Card(
                event_id=event_id,
                source_image_index=image_index,
                source_type=event.source_type,
                occurred_at=event.occurred_at,
                actor=event.actor,
                summary=summary or "",
                amount=event.amount,
                counterparty_name=counterparty_name,
                payer_name=payer_name,
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
