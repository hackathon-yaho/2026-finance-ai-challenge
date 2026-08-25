package com.haebing.backend.ai.dto;

import java.util.List;

/** docs/02-architecture/internal-api-contract.md "POST /internal/draft 응답". checklist는 AI가 항상 []로 채워 무시한다(백엔드가 자기 값으로 채움). */
public record DraftResult(String draftText, List<DraftSentence> sentences, boolean factCheckPassed) {
}
