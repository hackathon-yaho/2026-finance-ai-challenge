package com.haebing.backend.session;

import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Comparator;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * docs/backend/phase-2-session-intake.md 2-1. 인메모리 세션 저장소.
 * F1-01: 16자 랜덤 해시, 사용자 식별 정보에서 역산 불가.
 * F1-02: 30분 TTL, 요청마다 만료 시각을 갱신한다(무활동 기준).
 */
@Slf4j
@Component
public class SessionStore {

    static final Duration TTL = Duration.ofMinutes(30);
    private static final int HASH_LENGTH = 16;
    private static final String HASH_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
    private static final int MAX_SESSIONS = 10_000; // 저장소 포화 방어 (F1-01 예외)

    private final SecureRandom random = new SecureRandom();
    private final Map<String, Session> sessions = new ConcurrentHashMap<>();

    public Session create() {
        if (sessions.size() >= MAX_SESSIONS) {
            evictOldestExpired();
        }
        String hash = generateHash();
        Session session = new Session(hash, Instant.now().plus(TTL));
        sessions.put(hash, session);
        return session;
    }

    /** 세션이 없거나 만료됐으면 empty. 조회에 성공하면 TTL을 갱신한다(무활동 기준 슬라이딩). */
    public java.util.Optional<Session> find(String hash) {
        Session session = sessions.get(hash);
        if (session == null) {
            return java.util.Optional.empty();
        }
        if (session.getExpiresAt().isBefore(Instant.now())) {
            sessions.remove(hash);
            return java.util.Optional.empty();
        }
        session.setExpiresAt(Instant.now().plus(TTL));
        return java.util.Optional.of(session);
    }

    public void destroy(String hash) {
        // 파기 직전 익명 통계 적재 훅 (Phase 6, session_stat/stage_event) — 여기서는 자리만 잡아둔다.
        sessions.remove(hash);
    }

    private String generateHash() {
        StringBuilder sb = new StringBuilder(HASH_LENGTH);
        for (int i = 0; i < HASH_LENGTH; i++) {
            sb.append(HASH_ALPHABET.charAt(random.nextInt(HASH_ALPHABET.length())));
        }
        return sb.toString();
    }

    private void evictOldestExpired() {
        sessions.values().stream()
                .min(Comparator.comparing(Session::getExpiresAt))
                .ifPresent(s -> sessions.remove(s.getHash()));
    }

    /** 만료된 세션을 주기적으로 정리한다 (data-model.md 백엔드 체크리스트). */
    @Scheduled(fixedRate = 60_000)
    void cleanupExpired() {
        Instant now = Instant.now();
        int before = sessions.size();
        sessions.values().removeIf(s -> s.getExpiresAt().isBefore(now));
        int removed = before - sessions.size();
        if (removed > 0) {
            log.info("[SessionStore] 만료 세션 {}건 정리", removed);
        }
    }
}
