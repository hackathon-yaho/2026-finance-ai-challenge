package com.haebing.backend.session;

import java.util.List;

/** docs/02-architecture/api-contract.md "/api/timeline 응답 — 병합 후보 (F5-02)". */
public record MergeCandidate(String groupId, List<String> eventIds, String reason) {
}
