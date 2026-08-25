package com.haebing.backend.timeline.dto;

import com.haebing.backend.session.ExtractedEvent;
import com.haebing.backend.session.MergeCandidate;

import java.util.List;

/** docs/02-architecture/api-contract.md "GET /api/timeline 응답". */
public record TimelineResponse(List<ExtractedEvent> events, List<Gap> gaps, List<MergeCandidate> mergeCandidates) {
}
