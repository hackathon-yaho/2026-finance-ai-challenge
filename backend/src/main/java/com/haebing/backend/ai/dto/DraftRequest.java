package com.haebing.backend.ai.dto;

import com.haebing.backend.session.ExtractedEvent;

import java.util.List;

/** docs/02-architecture/internal-api-contract.md "POST /internal/draft 요청". events는 confirmed 카드만, 합성 이벤트 제외. */
public record DraftRequest(List<ExtractedEvent> events, String reason, String readiness, DraftIntake intake) {
}
