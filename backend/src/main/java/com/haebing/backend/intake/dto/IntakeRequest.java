package com.haebing.backend.intake.dto;

/**
 * docs/02-architecture/api-contract.md "/api/intake 요청 필드 정의".
 * 전부 nullable이다 — 프론트가 입력 즉시 증분 저장하므로 일부 필드만 온 요청도 정상이다.
 */
public record IntakeRequest(
        String when,
        String dueNoticeStatus,
        String dueNoticeDate,
        Long amount,
        String kind,
        Boolean history,
        String usage,
        String deliveryMethod
) {
}
