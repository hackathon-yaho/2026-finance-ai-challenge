package com.haebing.backend.timeline.controller;

import com.haebing.backend.session.Session;
import com.haebing.backend.session.interceptor.SessionInterceptor;
import com.haebing.backend.timeline.dto.MergeRequest;
import com.haebing.backend.timeline.dto.TimelineResponse;
import com.haebing.backend.timeline.service.TimelineService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/** docs/backend/phase-3-evidence-timeline.md 3-5. */
@RestController
@RequestMapping("/api/timeline")
@RequiredArgsConstructor
public class TimelineController {

    private final TimelineService timelineService;

    @GetMapping
    public ResponseEntity<TimelineResponse> get(HttpServletRequest request) {
        return ResponseEntity.ok(timelineService.getTimeline(currentSession(request)));
    }

    @PostMapping("/merge")
    public ResponseEntity<TimelineResponse> merge(@RequestBody MergeRequest req, HttpServletRequest request) {
        return ResponseEntity.ok(timelineService.approveMerge(currentSession(request), req));
    }

    private Session currentSession(HttpServletRequest request) {
        return (Session) request.getAttribute(SessionInterceptor.CURRENT_SESSION_ATTR);
    }
}
