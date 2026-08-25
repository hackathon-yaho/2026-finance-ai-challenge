package com.haebing.backend.textpackage.service;

/** 4면 — 순번 · 자료 유형 · 확인된 일시 · 한 줄 요약 · 원본 n번. 파일명·보유여부는 넣지 않는다. */
record EvidenceRow(int sequence, String sourceTypeLabel, String occurredAt, String summary, String originLabel) {
}
