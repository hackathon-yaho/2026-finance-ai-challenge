"""추출 JSON 후처리 PII 검증 — 프롬프트 금지 조항의 이중 방어 (spec F4-03).

수용 기준: 추출 JSON에 11자리 이상 숫자열·계좌번호·주민번호·전화번호 패턴이 없어야 한다.
거래 당사자 표시명(counterparty_name/payer_name)은 검증 대상이 아니다
(docs/response/backend/payer-name-extraction.md §2 — 단, 이름 필드에 숫자 식별자가 들어오면 제거).
"""

import re

RRN = re.compile(r"\d{6}\s*-?\s*[1-4]\d{6}")
PHONE = re.compile(r"01[016789]\s*-?\s*\d{3,4}\s*-?\s*\d{4}")
LONG_DIGITS = re.compile(r"\d[\d\s-]{9,}\d")

REDACTED = "[가려짐]"


def scrub_text(value: str | None) -> tuple[str | None, int]:
    if not value:
        return value, 0
    hits = 0
    for pattern in (RRN, PHONE, LONG_DIGITS):
        value, count = pattern.subn(REDACTED, value)
        hits += count
    return value, hits


def scrub_name(value: str | None) -> tuple[str | None, int]:
    if not value:
        return value, 0
    if RRN.search(value) or PHONE.search(value) or LONG_DIGITS.search(value):
        return None, 1
    return value, 0


def clean_account_last4(value: str | None) -> str | None:
    if not value:
        return None
    digits = re.sub(r"\D", "", value)
    if not digits:
        return None
    return digits[-4:]
