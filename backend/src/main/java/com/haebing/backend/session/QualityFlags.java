package com.haebing.backend.session;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * docs/02-architecture/internal-api-contract.md — 이미지 전체 품질(signals.quality_flags)과
 * 카드별 품질(qualityFlags, event_id를 키로 함)이 같은 모양을 쓴다.
 * amount_mismatch는 AI가 항상 false로 채운다 — 여러 자료를 함께 봐야 알 수 있어 백엔드가 계산해 덮어쓴다(F4-07).
 */
public record QualityFlags(
        boolean blurry,
        @JsonProperty("missing_date") boolean missingDate,
        @JsonProperty("amount_mismatch") boolean amountMismatch
) {
}
