package com.haebing.backend.evidence.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

/** 카드 필드 중 사용자가 고칠 수 있는 것만 — occurred_at/actor/amount/counterparty_name/payer_name (F4-06). */
public record Corrections(
        @JsonProperty("occurred_at") String occurredAt,
        String actor,
        Long amount,
        @JsonProperty("counterparty_name") String counterpartyName,
        @JsonProperty("payer_name") String payerName
) {
    public boolean isEmpty() {
        return occurredAt == null && actor == null && amount == null && counterpartyName == null && payerName == null;
    }
}
