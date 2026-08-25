package com.haebing.backend.timeline.dto;

import java.util.List;

/** docs/02-architecture/api-contract.md "POST /api/timeline/merge". mergeGroupIds는 groupId 배열이다(eventId 아님). */
public record MergeRequest(List<String> mergeGroupIds, boolean approved) {
}
