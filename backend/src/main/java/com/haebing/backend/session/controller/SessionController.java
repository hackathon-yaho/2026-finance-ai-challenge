package com.haebing.backend.session.controller;

import com.haebing.backend.session.Session;
import com.haebing.backend.session.SessionStore;
import com.haebing.backend.session.dto.SessionResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/** docs/backend/phase-2-session-intake.md 2-2. */
@RestController
@RequestMapping("/api/session")
@RequiredArgsConstructor
public class SessionController {

    private final SessionStore sessionStore;

    @Value("${app.demo-mode:false}")
    private boolean demoMode;

    @PostMapping
    public ResponseEntity<SessionResponse> create() {
        Session session = sessionStore.create();
        return ResponseEntity.ok(new SessionResponse(session.getHash(), session.getExpiresAt(), demoMode));
    }

    @DeleteMapping
    public ResponseEntity<Void> destroy(@RequestHeader("X-Session-Hash") String sessionHash) {
        sessionStore.destroy(sessionHash);
        return ResponseEntity.noContent().build();
    }
}
