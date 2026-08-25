package com.haebing.backend.readiness.service;

import java.util.List;

/**
 * 카탈로그 원소 — 아직 판정 전(status 없음). docs/01-product/reason-type-rules.md §2·3-2 단일 출처.
 * `sources`는 fulfillBy=upload일 때 "이 카드 source_type 중 하나라도 confirmed면 met"의 판정 재료다.
 */
public record ChecklistEntry(
        String id,
        String label,
        String tier,
        String fulfillBy,
        String whenMissing,
        String note,
        List<String> sources,
        List<ChecklistOptionEntry> options
) {
    public ChecklistEntry(String id, String label, String tier, String fulfillBy, String whenMissing,
                           String note, List<String> sources) {
        this(id, label, tier, fulfillBy, whenMissing, note, sources, null);
    }
}
