package com.haebing.backend.intake.service;

import com.haebing.backend.common.global.ErrorCode;
import com.haebing.backend.common.global.exception.BusinessException;
import com.haebing.backend.intake.dto.IntakeRequest;
import com.haebing.backend.session.Session;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

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

    /** dueNoticeDate 형식 오류는 500(Exception 폴백)이 아니라 400 INVALID_FORM_FIELD여야 한다. */
    @Test
    void notified_withMalformedDueNoticeDate_throwsInvalidFormFieldNot500() {
        Session session = new Session("abc", Instant.now().plusSeconds(1800));

        assertThatThrownBy(() -> service.save(session,
                new IntakeRequest(null, "notified", "2026/10/15", null, "goods", false, "main", "courier")))
                .isInstanceOf(BusinessException.class)
                .satisfies(e -> assertThat(((BusinessException) e).getErrorCode()).isEqualTo(ErrorCode.INVALID_FORM_FIELD));
    }

    /** 존재하지 않는 날짜(2월 30일)도 같은 오류 코드로 걸러야 한다 — 형식은 맞아도 파싱은 실패한다. */
    @Test
    void notified_withNonExistentCalendarDate_throwsInvalidFormField() {
        Session session = new Session("abc", Instant.now().plusSeconds(1800));

        assertThatThrownBy(() -> service.save(session,
                new IntakeRequest(null, "notified", "2026-02-30", null, "goods", false, "main", "courier")))
                .isInstanceOf(BusinessException.class)
                .satisfies(e -> assertThat(((BusinessException) e).getErrorCode()).isEqualTo(ErrorCode.INVALID_FORM_FIELD));
    }

    /** 형식 오류로 거부될 때는 그 전 정상 상태(하위 단계 결과 포함)를 무효화하지 않는다. */
    @Test
    void notified_withMalformedDueNoticeDate_doesNotInvalidateExistingDownstreamState() {
        Session session = new Session("abc", Instant.now().plusSeconds(1800));
        service.save(session, new IntakeRequest("2026-08-10", "unknown", null, null, "goods", false, "main", "courier"));
        session.setReadiness(new com.haebing.backend.session.Readiness("goods", "SUBMISSION_READY"));

        assertThatThrownBy(() -> service.save(session,
                new IntakeRequest("2026-08-10", "notified", "잘못된값", null, "goods", false, "main", "courier")))
                .isInstanceOf(BusinessException.class);

        assertThat(session.getReadiness()).isNotNull();
    }
}
