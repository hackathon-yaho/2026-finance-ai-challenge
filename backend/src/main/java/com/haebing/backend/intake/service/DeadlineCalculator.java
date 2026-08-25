package com.haebing.backend.intake.service;

import com.haebing.backend.intake.dto.DeadlineResponse;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

/**
 * docs/00-context/prd.md FR-014 기한 계산 로직. 법 제7조 제1항 — 기한은 공고일 + 2개월.
 * 순수 함수 — LLM을 쓰지 않고, 오늘 날짜를 인자로 받아 테스트 가능하게 한다.
 */
@Component
public class DeadlineCalculator {

    public DeadlineResponse calculate(String when, String dueNoticeStatus, String dueNoticeDate, LocalDate today) {
        if ("notified".equals(dueNoticeStatus) && dueNoticeDate != null && !dueNoticeDate.isBlank()) {
            LocalDate deadline = LocalDate.parse(dueNoticeDate).plusMonths(2);
            long daysLeft = ChronoUnit.DAYS.between(today, deadline);
            // FR-014 — 기한 경과가 확실해도 "불가능"으로 단정하지 않는다. "-56일 남았습니다"는 계산 실패처럼 읽혀 금지.
            String notice = daysLeft < 0
                    ? "공고일부터 2개월이 지난 것으로 보입니다. (%s) 기한 경과 여부와 이후 절차는 금융회사와 전문가 확인이 필요합니다.".formatted(deadline)
                    : "이의제기 기한까지 %d일 남았습니다. (%s)".formatted(daysLeft, deadline);
            return new DeadlineResponse(deadline.toString(), daysLeft, notice);
        }

        if (when != null && !when.isBlank()) {
            return new DeadlineResponse(null, null,
                    "아직 공고 전이라면 기한이 남아 있습니다. 공고일로부터 2개월이 기한이므로, 금융회사에 공고 여부를 먼저 확인하세요.");
        }

        return new DeadlineResponse(null, null,
                "지급정지 통지서에서 날짜를 확인해 주세요. 기한이 지나면 예금채권이 소멸할 수 있습니다.");
    }
}
