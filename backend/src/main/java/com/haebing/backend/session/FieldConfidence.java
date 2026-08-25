package com.haebing.backend.session;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * docs/02-architecture/internal-api-contract.md "신뢰도의 null".
 * occurred_at/actor/amount는 null을 허용하지 않는다. counterparty_name/payer_name은 이름이 null이면 함께 null이다.
 * amount/occurred_at이 null인 카드의 신뢰도는 게이팅 판단에서 읽지 않는다(값이 있는 카드에만 적용).
 */
public record FieldConfidence(
        @JsonProperty("occurred_at") String occurredAt,
        String actor,
        String amount,
        @JsonProperty("counterparty_name") String counterpartyName,
        @JsonProperty("payer_name") String payerName
) {
    public static final String HIGH = "high";
    public static final String MEDIUM = "medium";
    public static final String LOW = "low";
}
