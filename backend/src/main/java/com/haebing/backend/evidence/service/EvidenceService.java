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

    /** FR-028 게이팅 — 날짜/금액이 low 신뢰도인 미확인 카드가 있는지(값이 있는 경우에 한함). Phase 4의 /api/readiness가 쓴다. */
    boolean hasBlockingUnconfirmedCards(Session session);
}
