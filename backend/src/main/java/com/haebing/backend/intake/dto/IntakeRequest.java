package com.haebing.backend.intake.dto;

/**
 * docs/02-architecture/api-contract.md "/api/intake 요청 필드 정의".
 * 전부 nullable이다. **전체 교체(PUT류) 의미다** — 프론트는 요약 칩으로 앞 문항을 고칠 때마다
 * 문진 전체를 다시 보낸다(2026-08-26 로컬 연동 회신으로 확인). null로 온 필드는 세션에서 지운다.
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
