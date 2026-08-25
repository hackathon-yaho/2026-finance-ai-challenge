package com.haebing.backend.intake.service;

import com.haebing.backend.intake.dto.IntakeRequest;
import com.haebing.backend.session.Session;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

/** docs/request/backend/local-integration-findings.md §3 — 재전송 시 null이 이전 값을 지우지 않던 버그. */
class IntakeServiceImplTest {

    private final IntakeServiceImpl service = new IntakeServiceImpl(new DeadlineCalculator());

    @Test
    void resend_withNullField_clearsPreviouslySetValue() {
        Session session = new Session("abc", Instant.now().plusSeconds(1800));
        service.save(session, new IntakeRequest("2026-08-10", "unknown", null, null, null, null, null, null));
        assertThat(session.getIntake()).containsEntry("when", "2026-08-10");

        // 사용자가 요약 칩에서 "모름"으로 되돌림 — 프론트는 문진 전체를 다시 보낸다.
        service.save(session, new IntakeRequest(null, "unknown", null, null, null, null, null, null));

        assertThat(session.getIntake()).doesNotContainKey("when");
    }

    @Test
    void resend_withDifferentField_replacesRatherThanMerges() {
        Session session = new Session("abc", Instant.now().plusSeconds(1800));
        service.save(session, new IntakeRequest("2026-08-10", "not_yet", null, 100_000L, "goods", true, "main", "courier"));

        service.save(session, new IntakeRequest("2026-08-10", "not_yet", null, null, "goods", null, null, null));

        assertThat(session.getIntake())
                .containsEntry("when", "2026-08-10")
                .containsEntry("kind", "goods")
                .doesNotContainKey("amount")
                .doesNotContainKey("history")
                .doesNotContainKey("usage")
                .doesNotContainKey("deliveryMethod");
    }
}
