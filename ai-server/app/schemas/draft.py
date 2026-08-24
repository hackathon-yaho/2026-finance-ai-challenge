"""계약 스키마 — internal-api-contract.md의 /internal/draft 요청/응답과 1:1.

`intake`는 docs/request/backend/draft-intake-input.md 제안 필드(선택) — 백엔드 회신 전에도
받으면 사용하고, 없으면 events만으로 동작한다.
"""

from typing import Literal

from pydantic import BaseModel

from .card import Card, SourceRegion

Reason = Literal["goods", "service", "debt", "unclear"]
Readiness = Literal["SUBMISSION_READY", "SUPPLEMENT_NEEDED", "BANK_CHECK_REQUIRED"]


class IntakeFacts(BaseModel):
    when: str | None = None
    amount: int | None = None
    kind: str | None = None
    usage: str | None = None


class DraftRequest(BaseModel):
    events: list[Card]
    reason: Reason
    readiness: Readiness
    intake: IntakeFacts | None = None


class EvidenceRef(BaseModel):
    type: Literal["evidence", "intake", "user_text"]
    imageIndex: int | None = None
    bbox: SourceRegion | None = None


class Sentence(BaseModel):
    sentenceId: str
    text: str
    evidenceRefs: list[EvidenceRef]


class DraftResponse(BaseModel):
    draftText: str
    sentences: list[Sentence]
    checklist: list = []
    factCheckPassed: bool
