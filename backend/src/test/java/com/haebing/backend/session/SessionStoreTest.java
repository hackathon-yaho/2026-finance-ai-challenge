package com.haebing.backend.session;

import com.haebing.backend.stats.service.StatsService;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

class SessionStoreTest {

    private final StatsService noopStats = new StatsService() {
        public void recordStageComplete(Session session, int stage) {}
        public void recordAbandon(Session session) {}
        public void recordSessionEnd(Session session) {}
    };
    private final SessionStore store = new SessionStore(noopStats);

    @Test
    void create_issuesSixteenCharHashWithSlidingTtl() {
        Session session = store.create();

        assertThat(session.getHash()).hasSize(16);
        assertThat(session.getExpiresAt()).isAfter(Instant.now().plus(SessionStore.TTL.minusSeconds(5)));
    }

    @Test
    void find_expiredSession_returnsEmptyAndRemovesIt() {
        Session session = store.create();
        session.setExpiresAt(Instant.now().minusSeconds(1)); // 30분 무활동을 흉내낸다

        assertThat(store.find(session.getHash())).isEmpty();
        assertThat(store.find(session.getHash())).isEmpty(); // 제거까지 됐는지 재확인
    }

    @Test
    void find_validSession_slidesExpiryForward() {
        Session session = store.create();
        Instant originalExpiry = session.getExpiresAt();
        session.setExpiresAt(Instant.now().plusSeconds(1)); // 거의 만료 직전

        assertThat(store.find(session.getHash())).isPresent();
        assertThat(session.getExpiresAt()).isAfter(originalExpiry.minusSeconds(1));
    }

    @Test
    void destroy_thenFind_returnsEmpty() {
        Session session = store.create();

        store.destroy(session.getHash());

        assertThat(store.find(session.getHash())).isEmpty();
    }

    @Test
    void find_unknownHash_returnsEmpty() {
        assertThat(store.find("does-not-exist")).isEmpty();
    }

    @Test
    void destroy_recordsSessionEnd() {
        java.util.List<String> calls = new java.util.ArrayList<>();
        StatsService spyStats = new StatsService() {
            public void recordStageComplete(Session session, int stage) {}
            public void recordAbandon(Session session) { calls.add("abandon"); }
            public void recordSessionEnd(Session session) { calls.add("sessionEnd"); }
        };
        SessionStore spyStore = new SessionStore(spyStats);
        Session session = spyStore.create();

        spyStore.destroy(session.getHash());

        assertThat(calls).containsExactly("sessionEnd"); // 명시적 파기는 abandon이 아니다
    }

    @Test
    void cleanupExpired_recordsAbandonThenSessionEnd() {
        java.util.List<String> calls = new java.util.ArrayList<>();
        StatsService spyStats = new StatsService() {
            public void recordStageComplete(Session session, int stage) {}
            public void recordAbandon(Session session) { calls.add("abandon"); }
            public void recordSessionEnd(Session session) { calls.add("sessionEnd"); }
        };
        SessionStore spyStore = new SessionStore(spyStats);
        Session session = spyStore.create();
        session.setExpiresAt(Instant.now().minusSeconds(1));

        spyStore.cleanupExpired();

        assertThat(calls).containsExactly("abandon", "sessionEnd");
    }
}
