package com.haebing.backend.intake.service;

import com.haebing.backend.intake.dto.IntakeRequest;
import com.haebing.backend.intake.dto.IntakeResponse;
import com.haebing.backend.session.Session;

public interface IntakeService {

    /** 증분 저장 + F2-03 하위 단계 무효화 + FR-014 기한 계산. */
    IntakeResponse save(Session session, IntakeRequest request);
}
