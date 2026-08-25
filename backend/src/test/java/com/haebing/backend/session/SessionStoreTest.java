package com.haebing.backend.session;

import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

class SessionStoreTest {

    private final SessionStore store = new SessionStore();

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
}
