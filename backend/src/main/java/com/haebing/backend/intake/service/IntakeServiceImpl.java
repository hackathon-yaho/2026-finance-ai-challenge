package com.haebing.backend.intake.service;

import com.haebing.backend.common.global.ErrorCode;
import com.haebing.backend.common.global.exception.BusinessException;
import com.haebing.backend.intake.dto.DeadlineResponse;
import com.haebing.backend.intake.dto.IntakeRequest;
import com.haebing.backend.intake.dto.IntakeResponse;
import com.haebing.backend.session.Session;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.Map;

/** docs/backend/phase-2-session-intake.md 2-4·2-5·2-6. */
@Service
@RequiredArgsConstructor
public class IntakeServiceImpl implements IntakeService {

    private static final int NEXT_STAGE = 2;

    private final DeadlineCalculator deadlineCalculator;

    @Override
    public IntakeResponse save(Session session, IntakeRequest request) {
        Map<String, String> intake = session.getIntake();
        setOrClear(intake, "when", request.when());
        setOrClear(intake, "dueNoticeStatus", request.dueNoticeStatus());
        setOrClear(intake, "dueNoticeDate", request.dueNoticeDate());
        setOrClear(intake, "amount", request.amount() == null ? null : String.valueOf(request.amount()));
        setOrClear(intake, "kind", request.kind());
        setOrClear(intake, "history", request.history() == null ? null : String.valueOf(request.history()));
        setOrClear(intake, "usage", request.usage());
        setOrClear(intake, "deliveryMethod", request.deliveryMethod());

        String dueNoticeStatus = intake.get("dueNoticeStatus");
        String dueNoticeDate = intake.get("dueNoticeDate");
        if ("notified".equals(dueNoticeStatus) && (dueNoticeDate == null || dueNoticeDate.isBlank())) {
            throw new BusinessException(ErrorCode.INVALID_FORM_FIELD, "dueNoticeStatus가 notified이면 dueNoticeDate가 필요합니다");
        }

        DeadlineResponse deadline;
        try {
            deadline = deadlineCalculator.calculate(intake.get("when"), dueNoticeStatus, dueNoticeDate, LocalDate.now());
        } catch (DateTimeParseException e) {
            // dueNoticeDate가 YYYY-MM-DD 형식이 아니거나(예: "2026/10/15") 존재하지 않는 날짜(예: 2월 30일)다.
            // 사용자 입력 오류이지 서버 오류가 아니다 — Exception 폴백(500)으로 새지 않게 여기서 400으로 정정한다.
            throw new BusinessException(ErrorCode.INVALID_FORM_FIELD, "dueNoticeDate는 YYYY-MM-DD 형식의 유효한 날짜여야 합니다");
        }

        // F2-03 — 문진이 바뀌면 하위 단계 결과를 무효화한다. 데모 핵심 장면이라 항상 초기화한다.
        // 형식 검증 이후에 실행한다 — 잘못된 입력 때문에 앞서 계산해 둔 정상 상태를 지우지 않는다.
        session.invalidateDownstream();

        return new IntakeResponse(true, NEXT_STAGE, deadline);
    }

    /** 전체 교체 의미 — 프론트가 문진 전체를 매번 다시 보내므로, null은 "이전 값 유지"가 아니라 "지움"이다. */
    private void setOrClear(Map<String, String> intake, String key, String value) {
        if (value != null) {
            intake.put(key, value);
        } else {
            intake.remove(key);
        }
    }
}
