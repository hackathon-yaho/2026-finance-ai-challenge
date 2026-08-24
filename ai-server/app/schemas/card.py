"""계약 스키마 — internal-api-contract.md의 /internal/extract 응답과 1:1.

공개 API(api-contract.md) 카드 스키마와 동일해야 한다. 여기를 바꾸려면 계약 문서를 먼저 고친다.
"""

from typing import Literal

from pydantic import BaseModel

Confidence = Literal["high", "medium", "low"]
SourceType = Literal["chat", "bank", "shipping", "threat", "autopay", "unknown"]
Actor = Literal["self", "counterparty", "system"]


class SourceRegion(BaseModel):
    x: float
    y: float
    w: float
    h: float


class Identifiers(BaseModel):
    tracking_no: str | None = None
    account_last4: str | None = None


class FieldConfidence(BaseModel):
    """이름 신뢰도는 값이 없으면 None이다 (계약 "신뢰도의 null" 절).

    "값이 없는데 높은 신뢰도"라는 조합은 성립하지 않는다. 불변식은 extraction._to_cards가
    결정적으로 강제한다 — LLM에게 맡기면 비결정적이 된다.
    occurred_at/actor/amount는 프론트가 항상 배지로 렌더하므로 3값을 유지한다.
    """

    occurred_at: Confidence
    actor: Confidence
    amount: Confidence
    counterparty_name: Confidence | None = None
    payer_name: Confidence | None = None


class QualityFlags(BaseModel):
    blurry: bool = False
    missing_date: bool = False
    amount_mismatch: bool = False


class Card(BaseModel):
    event_id: str
    source_image_index: int | None
    source_type: SourceType
    occurred_at: str | None
    actor: Actor
    summary: str
    amount: int | None
    counterparty_name: str | None = None
    payer_name: str | None = None
    identifiers: Identifiers = Identifiers()
    field_confidence: FieldConfidence
    source_region: SourceRegion | None = None
    confirmation_status: str = "pending"


class Signals(BaseModel):
    threat_detected: bool = False
    delivery_evidence: bool = False
    life_activity: bool = False
    quality_flags: QualityFlags = QualityFlags()


class ExtractResponse(BaseModel):
    cards: list[Card]
    signals: Signals
    qualityFlags: dict[str, QualityFlags]


class RawTextRequest(BaseModel):
    rawText: str
