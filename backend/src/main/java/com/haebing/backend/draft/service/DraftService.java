package com.haebing.backend.draft.service;

import com.haebing.backend.draft.dto.DraftResponse;
import com.haebing.backend.draft.dto.ReviseRequest;
import com.haebing.backend.draft.dto.ReviseResponse;
import com.haebing.backend.session.Session;

public interface DraftService {

    /** docs/backend/phase-5-draft-package.md 5-1. AI-server 호출 → factCheckPassed 재시도 1회 → 세션 저장. */
    DraftResponse generate(Session session);

    /** docs/backend/phase-5-draft-package.md 5-4a. */
    ReviseResponse revise(Session session, ReviseRequest request);
}
