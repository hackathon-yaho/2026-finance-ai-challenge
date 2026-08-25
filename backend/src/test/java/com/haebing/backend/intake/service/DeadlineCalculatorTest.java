package com.haebing.backend.intake.service;

import com.haebing.backend.intake.dto.DeadlineResponse;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

/** docs/backend/phase-2-session-intake.md 2-5 — 공고일 있음 / 공고 전 / 모름 / 지급정지일도 없음 4케이스. */
class DeadlineCalculatorTest {

    private final DeadlineCalculator calculator = new DeadlineCalculator();
    private final LocalDate today = LocalDate.of(2026, 8, 25);

    @Test
    void 공고일_있음_기한은_공고일_2개월_후() {
        DeadlineResponse result = calculator.calculate("2026-08-01", "notified", "2026-09-01", today);

        assertThat(result.date()).isEqualTo("2026-11-01");
        assertThat(result.daysLeft()).isEqualTo(68); // 2026-08-25 -> 2026-11-01
        assertThat(result.notice()).isEqualTo("이의제기 기한까지 68일 남았습니다. (2026-11-01)");
    }

    @Test
    void 공고_전이면_날짜없이_확인_안내만() {
        DeadlineResponse result = calculator.calculate("2026-08-01", "not_yet", null, today);

        assertThat(result.date()).isNull();
        assertThat(result.daysLeft()).isNull();
        assertThat(result.notice()).contains("아직 공고 전이라면 기한이 남아 있습니다");
    }

    @Test
    void 공고_상태를_모르면_날짜없이_확인_안내만() {
        DeadlineResponse result = calculator.calculate("2026-08-01", "unknown", null, today);

        assertThat(result.date()).isNull();
        assertThat(result.daysLeft()).isNull();
        assertThat(result.notice()).contains("아직 공고 전이라면 기한이 남아 있습니다");
    }

    @Test
    void 지급정지일도_모르면_날짜_확인_안내로_대체() {
        DeadlineResponse result = calculator.calculate(null, "unknown", null, today);

        assertThat(result.date()).isNull();
        assertThat(result.daysLeft()).isNull();
        assertThat(result.notice()).isEqualTo("지급정지 통지서에서 날짜를 확인해 주세요. 기한이 지나면 예금채권이 소멸할 수 있습니다.");
    }
}
