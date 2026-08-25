package com.haebing.backend.readiness.dto;

import java.util.List;

/** docs/02-architecture/api-contract.md "/api/readiness 응답" checklist 원소. */
public record ChecklistItem(
        String id,
        String label,
        String tier,
        String fulfillBy,
        String whenMissing,
        String status,
        String note,
        List<ChecklistOption> options
) {
    public static final String TIER_LEGAL = "legal";
    public static final String TIER_FSS = "fss";
    public static final String TIER_COMMON = "common";
    public static final String TIER_SUPPORTING = "supporting";

    public static final String FULFILL_UPLOAD = "upload";
    public static final String FULFILL_SELF = "self";
    public static final String FULFILL_DERIVED = "derived";

    public static final String WHEN_MISSING_BLOCKS = "blocks";
    public static final String WHEN_MISSING_NOTICE = "notice";
    public static final String WHEN_MISSING_SILENT = "silent";

    public static final String STATUS_MET = "met";
    public static final String STATUS_UNMET = "unmet";
    public static final String STATUS_UNKNOWN = "unknown";
    public static final String STATUS_NEEDS_EXPLANATION = "needs_explanation";
}
