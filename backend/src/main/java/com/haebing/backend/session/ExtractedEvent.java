package com.haebing.backend.session;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * docs/02-architecture/internal-api-contract.md "응답 — 추출 카드 스키마".
 * 외부 API(/api/evidence 등)와 내부 API(AI-server)가 같은 형식을 쓴다 — 필드명은 snake_case가 계약이다.
 */
public record ExtractedEvent(
        @JsonProperty("event_id") String eventId,
        @JsonProperty("source_image_index") Integer sourceImageIndex,
        @JsonProperty("source_type") String sourceType,
        @JsonProperty("occurred_at") String occurredAt,
        String actor,
        String summary,
        Long amount,
        @JsonProperty("counterparty_name") String counterpartyName,
        @JsonProperty("payer_name") String payerName,
        Identifiers identifiers,
        @JsonProperty("field_confidence") FieldConfidence fieldConfidence,
        @JsonProperty("source_region") SourceRegion sourceRegion,
        @JsonProperty("confirmation_status") String confirmationStatus
) {
    public static final String PENDING = "pending";
    public static final String USER_CONFIRMED = "user_confirmed";
    public static final String USER_CORRECTED = "user_corrected";

    /** 문진 응답에서 백엔드가 직접 합성한 카드(AI 출처가 아님). 2026-08-26 계약 확정 — docs/request/backend/local-integration-findings.md §4. */
    public static final String SOURCE_TYPE_INTAKE = "intake";
    public static final String EVENT_ID_INTAKE_WHEN = "evt_intake_when";

    /** F5-01 — 사용자가 입력한 지급정지일을 이벤트로 합성한다. 3면(타임라인)에는 포함하고 4면(증빙목록)에서는 제외한다. */
    public static ExtractedEvent intakeDueDateEvent(String when) {
        return new ExtractedEvent(
                EVENT_ID_INTAKE_WHEN, null, SOURCE_TYPE_INTAKE, when, "self", "지급정지일 (본인 입력)", null, null, null,
                null,
                new FieldConfidence("low", "low", "low", null, null),
                null, USER_CONFIRMED
        );
    }

    /** F5-01 tie-break — 화면 표시 순서일 뿐 의미 판정이 아니다. */
    public static int sourceTypeRank(String sourceType) {
        if (sourceType == null) return 5;
        return switch (sourceType) {
            case "chat" -> 0;
            case "bank" -> 1;
            case "shipping" -> 2;
            case "threat" -> 3;
            case "autopay" -> 4;
            default -> 5; // unknown
        };
    }

    /** F4-06 corrections 반영 — null이 아닌 필드만 덮어써 새 카드를 만든다. */
    public ExtractedEvent withCorrections(String occurredAt, String actor, Long amount,
                                           String counterpartyName, String payerName) {
        return new ExtractedEvent(
                eventId,
                sourceImageIndex,
                sourceType,
                occurredAt != null ? occurredAt : this.occurredAt,
                actor != null ? actor : this.actor,
                summary,
                amount != null ? amount : this.amount,
                counterpartyName != null ? counterpartyName : this.counterpartyName,
                payerName != null ? payerName : this.payerName,
                identifiers,
                fieldConfidence,
                sourceRegion,
                confirmationStatus
        );
    }

    public ExtractedEvent withConfirmationStatus(String status) {
        return new ExtractedEvent(eventId, sourceImageIndex, sourceType, occurredAt, actor, summary, amount,
                counterpartyName, payerName, identifiers, fieldConfidence, sourceRegion, status);
    }
}
