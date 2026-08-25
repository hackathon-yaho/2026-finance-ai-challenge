package com.haebing.backend.intake.dto;

/** docs/02-architecture/api-contract.md "/api/intake 응답 — 이의제기 기한". notice는 항상 채워진다. */
public record DeadlineResponse(String date, Long daysLeft, String notice) {
}
