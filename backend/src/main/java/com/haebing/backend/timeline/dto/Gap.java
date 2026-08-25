package com.haebing.backend.timeline.dto;

import java.util.List;

/**
 * docs/backend/phase-3-evidence-timeline.md F5-03/F5-04. api-contract.md에는 `gaps: []`만 있고
 * 항목 스키마가 없어 여기서 정의했다 — `api-contract.md`에도 반영해 둔다.
 */
public record Gap(String type, String label, List<String> suggestions) {

    public static final String NO_DELIVERY_EVIDENCE = "no_delivery_evidence";
    public static final String NO_SERVICE_EVIDENCE = "no_service_evidence";
    public static final String NO_LIFE_ACTIVITY = "no_life_activity";
    public static final String NO_CHAT_EVIDENCE = "no_chat_evidence";
}
