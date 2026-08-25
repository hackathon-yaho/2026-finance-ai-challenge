package com.haebing.backend.readiness.controller;

import com.haebing.backend.readiness.dto.SelfHeldRequest;
import com.haebing.backend.readiness.dto.SelfHeldResponse;
import com.haebing.backend.readiness.service.ReadinessService;
import com.haebing.backend.session.Session;
import com.haebing.backend.session.interceptor.SessionInterceptor;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** docs/backend/phase-4-readiness.md 4-3a "fulfillBy: SELF 항목은 사용자 자가 진술로 받는다". */
@RestController
@RequestMapping("/api/checklist")
@RequiredArgsConstructor
public class ChecklistController {

    private final ReadinessService readinessService;

    @PostMapping("/self-held")
    public ResponseEntity<SelfHeldResponse> selfHeld(@RequestBody SelfHeldRequest req, HttpServletRequest request) {
        Session session = (Session) request.getAttribute(SessionInterceptor.CURRENT_SESSION_ATTR);
        return ResponseEntity.ok(new SelfHeldResponse(readinessService.selfHeld(session, req)));
    }
}
