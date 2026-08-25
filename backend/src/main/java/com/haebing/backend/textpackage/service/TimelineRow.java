package com.haebing.backend.textpackage.service;

/** 3면 — 일시 · 행위 주체 · 요약 · 금액. confirmed 카드만 (2026-08-26 명시). */
record TimelineRow(String occurredAt, String actor, String summary, String amountText) {
}
