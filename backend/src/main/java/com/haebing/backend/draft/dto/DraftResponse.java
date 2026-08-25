package com.haebing.backend.draft.dto;

import com.haebing.backend.ai.dto.DraftSentence;
import com.haebing.backend.readiness.dto.ChecklistItem;

import java.util.List;

/**
 * docs/02-architecture/api-contract.md "/api/draft 응답". `checklist`는 AI 값이 아니라
 * 백엔드 ReadinessService(Phase 4)가 계산한 값을 그대로 쓴다 — 담당은 A(백엔드)다.
 */
public record DraftResponse(String draftText, List<DraftSentence> sentences, List<ChecklistItem> checklist) {
}
