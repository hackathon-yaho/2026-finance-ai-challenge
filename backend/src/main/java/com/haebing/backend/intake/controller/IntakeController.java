package com.haebing.backend.intake.controller;

import com.haebing.backend.intake.dto.IntakeRequest;
import com.haebing.backend.intake.dto.IntakeResponse;
import com.haebing.backend.intake.service.IntakeService;
import com.haebing.backend.session.Session;
import com.haebing.backend.session.interceptor.SessionInterceptor;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** docs/backend/phase-2-session-intake.md 2-4. 세션은 SessionInterceptor가 이미 검증해 request 속성에 담아둔다. */
@RestController
@RequestMapping("/api/intake")
@RequiredArgsConstructor
public class IntakeController {

    private final IntakeService intakeService;

    @PostMapping
    public ResponseEntity<IntakeResponse> save(@RequestBody IntakeRequest request, HttpServletRequest httpRequest) {
        Session session = (Session) httpRequest.getAttribute(SessionInterceptor.CURRENT_SESSION_ATTR);
        return ResponseEntity.ok(intakeService.save(session, request));
    }
}
