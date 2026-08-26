package com.haebing.backend.textpackage.service;

/**
 * 4면 — 첨부(원본) 한 개당 한 줄이다(카드 단위 아님, 2026-08-26 개선).
 * {@code occurredAt}은 그 원본에서 나온 카드들의 일시 범위, {@code summary}는 건수 + 대표 사실 하나.
 * 파일명·보유여부는 넣지 않는다.
 */
record EvidenceRow(int sequence, String sourceTypeLabel, String occurredAt, String summary, String originLabel) {
}
