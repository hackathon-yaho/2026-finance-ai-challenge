package com.haebing.backend.readiness.dto;

import java.util.List;

/** docs/02-architecture/api-contract.md "/api/readiness 응답". */
public record ReadinessResponse(
        String reason,
        List<ChecklistItem> checklist,
        String readiness,
        List<String> missingItems,
        List<String> conflicts,
        List<String> notices,
        String smallAmountNotice,
        boolean urgentAlert
) {
    public static final String SUBMISSION_READY = "SUBMISSION_READY";
    public static final String SUPPLEMENT_NEEDED = "SUPPLEMENT_NEEDED";
    public static final String BANK_CHECK_REQUIRED = "BANK_CHECK_REQUIRED";
}
