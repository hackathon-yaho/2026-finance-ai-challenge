package com.haebing.backend.health.controller;

import com.haebing.backend.health.service.HealthService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * F11-01. Render 무료 티어 슬립 + Supabase 7일 일시정지를 동시에 방어한다 — 요청 하나로
 * 앱과 DB를 둘 다 깨운다. 계약 경로가 `/actuator/health`로 고정돼 있어 `/api` 프리픽스를 쓰지 않는다.
 */
@Slf4j
@RestController
@RequestMapping("/actuator/health")
@RequiredArgsConstructor
public class HealthController {

    private final HealthService healthService;

    @GetMapping
    public ResponseEntity<Map<String, String>> check() {
        try {
            healthService.ping();
            return ResponseEntity.ok(Map.of("status", "UP", "db", "OK"));
        } catch (Exception e) {
            log.error("[HealthController] DB 헬스체크 실패", e);
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of("status", "DOWN", "db", "FAIL"));
        }
    }
}
