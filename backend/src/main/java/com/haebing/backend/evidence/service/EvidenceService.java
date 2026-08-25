package com.haebing.backend.evidence.service;

import com.haebing.backend.ai.dto.ExtractResult;
import com.haebing.backend.evidence.dto.ConfirmRequest;
import com.haebing.backend.evidence.dto.ConfirmResponse;
import com.haebing.backend.session.Session;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

public interface EvidenceService {

    /** F3-02 검증 → AiClient 호출 → 세션 저장 → F4-07 금액 교차 대조까지 한 번에 처리한다. */
    ExtractResult uploadImages(Session session, List<MultipartFile> files, List<Integer> imageIndexes);

    ExtractResult uploadText(Session session, String rawText);

    ConfirmResponse confirm(Session session, ConfirmRequest request);

    /**
     * FR-028 서버 측 하드 게이팅 — 날짜/금액이 low 신뢰도인 미확인 카드가 있는지(값이 있는 경우에 한함).
     * 있으면 /api/readiness 자체를 409로 거부한다(Phase 3 "게이팅" 절).
     */
    boolean hasBlockingUnconfirmedCards(Session session);

    /**
     * F6-04 hasUnconfirmedFields 신호 — 신뢰도와 무관하게 미확인(pending) 카드가 하나라도 있는지.
     * 위 하드 게이팅보다 넓다 — low 신뢰도가 아닌 미확인 카드는 통과는 시키되 SUPPLEMENT_NEEDED로만 반영한다.
     */
    boolean hasAnyPendingCard(Session session);
}
