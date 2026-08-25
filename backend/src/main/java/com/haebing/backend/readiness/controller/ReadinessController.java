package com.haebing.backend.readiness.controller;

import com.haebing.backend.common.global.ErrorCode;
import com.haebing.backend.common.global.exception.BusinessException;
import com.haebing.backend.evidence.service.EvidenceService;
import com.haebing.backend.readiness.dto.ReadinessResponse;
import com.haebing.backend.readiness.service.ReadinessService;
import com.haebing.backend.session.Session;
import com.haebing.backend.session.interceptor.SessionInterceptor;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** docs/backend/phase-3-evidence-timeline.md "게이팅" + docs/backend/phase-4-readiness.md. */
@RestController
@RequestMapping("/api/readiness")
@RequiredArgsConstructor
public class ReadinessController {

    private final ReadinessService readinessService;
    private final EvidenceService evidenceService;

    @PostMapping
    public ResponseEntity<ReadinessResponse> evaluate(HttpServletRequest request) {
        Session session = (Session) request.getAttribute(SessionInterceptor.CURRENT_SESSION_ATTR);

        // 서버 측 하드 게이팅 — low 신뢰도(값이 있는 경우) 미확인 카드가 있으면 준비도 산출 자체를 거부한다.
        if (evidenceService.hasBlockingUnconfirmedCards(session)) {
            throw new BusinessException(ErrorCode.UNCONFIRMED_FIELDS);
        }

        return ResponseEntity.ok(readinessService.evaluate(session));
    }
}
