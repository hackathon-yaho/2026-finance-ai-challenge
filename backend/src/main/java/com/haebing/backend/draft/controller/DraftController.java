package com.haebing.backend.draft.controller;

import com.haebing.backend.common.global.ErrorCode;
import com.haebing.backend.common.global.exception.BusinessException;
import com.haebing.backend.draft.dto.DraftResponse;
import com.haebing.backend.draft.dto.ReviseRequest;
import com.haebing.backend.draft.dto.ReviseResponse;
import com.haebing.backend.draft.service.DraftService;
import com.haebing.backend.evidence.service.EvidenceService;
import com.haebing.backend.session.Session;
import com.haebing.backend.session.interceptor.SessionInterceptor;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** docs/backend/phase-5-draft-package.md 5-1·5-4a. */
@RestController
@RequestMapping("/api/draft")
@RequiredArgsConstructor
public class DraftController {

    private final DraftService draftService;
    private final EvidenceService evidenceService;

    @PostMapping
    public ResponseEntity<DraftResponse> generate(HttpServletRequest request) {
        Session session = currentSession(request);
        if (evidenceService.hasBlockingUnconfirmedCards(session)) {
            throw new BusinessException(ErrorCode.UNCONFIRMED_FIELDS);
        }
        return ResponseEntity.ok(draftService.generate(session));
    }

    @PostMapping("/revise")
    public ResponseEntity<ReviseResponse> revise(@RequestBody ReviseRequest req, HttpServletRequest request) {
        return ResponseEntity.ok(draftService.revise(currentSession(request), req));
    }

    private Session currentSession(HttpServletRequest request) {
        return (Session) request.getAttribute(SessionInterceptor.CURRENT_SESSION_ATTR);
    }
}
