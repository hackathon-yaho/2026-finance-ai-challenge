package com.haebing.backend.readiness.service;

import com.haebing.backend.readiness.dto.ReadinessResponse;
import com.haebing.backend.readiness.dto.SelfHeldRequest;
import com.haebing.backend.session.Session;

import java.util.List;

public interface ReadinessService {

    /** docs/backend/phase-4-readiness.md 4-4. 결정적 규칙 엔진 — LLM 호출 없음. */
    ReadinessResponse evaluate(Session session);

    /** POST /api/checklist/self-held — 갱신된 전체 체크리스트를 돌려준다(부분 갱신 불가). */
    List<com.haebing.backend.readiness.dto.ChecklistItem> selfHeld(Session session, SelfHeldRequest request);
}
