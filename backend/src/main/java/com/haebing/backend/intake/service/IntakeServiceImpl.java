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
        putIfPresent(intake, "when", request.when());
        putIfPresent(intake, "dueNoticeStatus", request.dueNoticeStatus());
        putIfPresent(intake, "dueNoticeDate", request.dueNoticeDate());
        putIfPresent(intake, "amount", request.amount() == null ? null : String.valueOf(request.amount()));
        putIfPresent(intake, "kind", request.kind());
        putIfPresent(intake, "history", request.history() == null ? null : String.valueOf(request.history()));
        putIfPresent(intake, "usage", request.usage());
        putIfPresent(intake, "deliveryMethod", request.deliveryMethod());

        String dueNoticeStatus = intake.get("dueNoticeStatus");
        String dueNoticeDate = intake.get("dueNoticeDate");
        if ("notified".equals(dueNoticeStatus) && (dueNoticeDate == null || dueNoticeDate.isBlank())) {
            throw new BusinessException(ErrorCode.INVALID_FORM_FIELD, "dueNoticeStatus가 notified이면 dueNoticeDate가 필요합니다");
        }

        // F2-03 — 문진이 바뀌면 하위 단계 결과를 무효화한다. 데모 핵심 장면이라 항상 초기화한다.
        session.invalidateDownstream();

        DeadlineResponse deadline = deadlineCalculator.calculate(intake.get("when"), dueNoticeStatus, dueNoticeDate, LocalDate.now());
        return new IntakeResponse(true, NEXT_STAGE, deadline);
    }

    private void putIfPresent(Map<String, String> intake, String key, String value) {
        if (value != null) {
            intake.put(key, value);
        }
    }
}
