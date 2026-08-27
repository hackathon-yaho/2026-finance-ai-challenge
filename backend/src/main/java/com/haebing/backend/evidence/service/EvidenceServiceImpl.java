package com.haebing.backend.evidence.service;

import com.haebing.backend.ai.AiClient;
import com.haebing.backend.ai.dto.ExtractResult;
import com.haebing.backend.common.global.ErrorCode;
import com.haebing.backend.common.global.exception.BusinessException;
import com.haebing.backend.evidence.dto.ConfirmRequest;
import com.haebing.backend.evidence.dto.ConfirmResponse;
import com.haebing.backend.evidence.dto.Corrections;
import com.haebing.backend.evidence.validation.FileValidator;
import com.haebing.backend.session.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.*;

/** docs/backend/phase-3-evidence-timeline.md 3-2·3-3·3-4. */
@Slf4j
@Service
@RequiredArgsConstructor
public class EvidenceServiceImpl implements EvidenceService {

    private static final int MAX_IMAGES_PER_SESSION = 10;

    private final FileValidator fileValidator;
    private final AiClient aiClient;

    @Override
    public ExtractResult uploadImages(Session session, List<MultipartFile> files, List<Integer> imageIndexes) {
        if (files.size() != imageIndexes.size()) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST, "files와 imageIndex 개수가 일치하지 않습니다");
        }

        List<ExtractedEvent> newCards = new ArrayList<>();
        Map<String, QualityFlags> newQualityFlags = new HashMap<>();
        BusinessException lastFailure = null;
        int accepted = 0;

        for (int i = 0; i < files.size(); i++) {
            MultipartFile file = files.get(i);
            int imageIndex = imageIndexes.get(i);
            String contentType = validateFile(file);
            if (contentType == null) {
                log.warn("[EvidenceService] 파일 검증 실패로 스킵: {}", file.getOriginalFilename());
                continue;
            }
            if (session.getUploadedImageCount().get() >= MAX_IMAGES_PER_SESSION) {
                throw new BusinessException(ErrorCode.INVALID_REQUEST, "세션당 최대 " + MAX_IMAGES_PER_SESSION + "장까지 업로드할 수 있습니다");
            }
            session.getUploadedImageCount().incrementAndGet();

            try {
                byte[] bytes = file.getBytes();
                ExtractResult result = aiClient.extractFromImage(bytes, imageIndex, contentType,
                        java.time.LocalDate.now().toString(), session.getIntake().get("when"));
                accepted++;
                newCards.addAll(result.cards());
                newQualityFlags.putAll(result.qualityFlags());
                session.setSignals(session.getSignals().mergedWith(result.signals()));
            } catch (BusinessException e) {
                log.warn("[EvidenceService] 이미지 {} 판독 실패: {}", imageIndex, e.getMessage());
                lastFailure = e; // F4-05 — 일부 실패는 스킵하고 나머지로 진행. 전부 실패하면 아래에서 그대로 전달한다.
            } catch (IOException e) {
                throw new IllegalStateException("업로드 파일을 읽을 수 없습니다", e);
            }
        }

        if (accepted == 0) {
            if (lastFailure != null) throw lastFailure;
            throw new BusinessException(ErrorCode.INVALID_REQUEST, "유효한 이미지 파일이 없습니다");
        }

        newCards.forEach(session::upsertCard);
        newQualityFlags.forEach(session.getQualityFlags()::put);
        recomputeAmountMismatch(session);
        // F4-07 — recompute가 세션의 amount_mismatch를 갱신한 뒤이므로, 응답도 세션에서 다시 읽어
        // 재계산 전 스냅샷(newQualityFlags)을 그대로 내려보내지 않는다.
        newQualityFlags.replaceAll((eventId, flags) -> session.getQualityFlags().get(eventId));

        return new ExtractResult(newCards, session.getSignals(), newQualityFlags);
    }

    @Override
    public ExtractResult uploadText(Session session, String rawText) {
        ExtractResult result = aiClient.extractFromText(rawText,
                java.time.LocalDate.now().toString(), session.getIntake().get("when"));
        result.cards().forEach(session::upsertCard);
        result.qualityFlags().forEach(session.getQualityFlags()::put);
        session.setSignals(session.getSignals().mergedWith(result.signals()));
        recomputeAmountMismatch(session);

        Map<String, QualityFlags> updatedFlags = new HashMap<>();
        result.qualityFlags().keySet().forEach(id -> updatedFlags.put(id, session.getQualityFlags().get(id)));
        return new ExtractResult(result.cards(), session.getSignals(), updatedFlags);
    }

    @Override
    public ConfirmResponse confirm(Session session, ConfirmRequest request) {
        ExtractedEvent card = session.findCard(request.cardId())
                .orElseThrow(() -> new BusinessException(ErrorCode.INVALID_REQUEST, "존재하지 않는 카드입니다: " + request.cardId()));

        if (!request.confirmed()) {
            // F4-06 처리 ④ 카드 삭제 지원 — 이 엔드포인트로 confirmed:false가 오면 삭제로 처리한다.
            session.removeCard(request.cardId());
        } else {
            Corrections c = request.corrections();
            if (c != null && !c.isEmpty()) {
                card = card.withCorrections(c.occurredAt(), c.actor(), c.amount(), c.counterpartyName(), c.payerName())
                        .withConfirmationStatus(ExtractedEvent.USER_CORRECTED);
            } else {
                card = card.withConfirmationStatus(ExtractedEvent.USER_CONFIRMED);
            }
            session.upsertCard(card);
        }

        recomputeAmountMismatch(session);

        int confirmedCount = 0;
        int unconfirmedCount = 0;
        for (ExtractedEvent e : session.getTimeline()) {
            if (ExtractedEvent.PENDING.equals(e.confirmationStatus())) {
                unconfirmedCount++;
            } else {
                confirmedCount++;
            }
        }
        return new ConfirmResponse(true, confirmedCount, unconfirmedCount);
    }

    @Override
    public boolean hasBlockingUnconfirmedCards(Session session) {
        for (ExtractedEvent card : session.getTimeline()) {
            if (!ExtractedEvent.PENDING.equals(card.confirmationStatus())) continue;
            FieldConfidence fc = card.fieldConfidence();
            // 계약(internal-api-contract.md)은 field_confidence가 항상 채워진다고 보장하지만, AI-server가
            // 이 계약을 어기면(계약 위반 하나로 게이팅 전체가 NPE→500이 되는 것을 막는다) 값이 있는데
            // 신뢰도를 모르는 상태로 보고 보수적으로 차단한다 — 조용히 통과시키는 쪽이 더 위험하다(F4-06).
            //
            // occurred_at == null은 amount == null과 성격이 다르다(docs/request/backend/
            // repeated-events-and-irrelevant-cards.md §7). 대화 캡처에 금액이 없는 것은 정상이지만,
            // 은행 앱이 연도를 안 보여줘 날짜를 못 읽은 것은 정보 누락이다 — amount처럼 "값 없으면
            // 신뢰도 안 읽고 통과"가 아니라, 값이 없다는 사실 자체가 확인이 필요한 상태다.
            boolean dateBlocks = card.occurredAt() == null || fc == null || FieldConfidence.LOW.equals(fc.occurredAt());
            boolean amountBlocks = card.amount() != null && (fc == null || FieldConfidence.LOW.equals(fc.amount()));
            if (dateBlocks || amountBlocks) return true;
        }
        return false;
    }

    @Override
    public boolean hasAnyPendingCard(Session session) {
        return session.getTimeline().stream()
                .anyMatch(card -> ExtractedEvent.PENDING.equals(card.confirmationStatus()));
    }

    /**
     * F4-07 — 세션에 쌓인 카드들의 amount를 서로 대조한다. 서버 몫(LLM은 이미지 1장씩만 보므로 판단 불가).
     * 값이 있는 금액들이 전부 같지 않으면, 금액이 있는 모든 카드에 amount_mismatch를 세운다.
     */
    private void recomputeAmountMismatch(Session session) {
        Set<Long> distinctAmounts = new HashSet<>();
        for (ExtractedEvent card : session.getTimeline()) {
            if (card.amount() != null) distinctAmounts.add(card.amount());
        }
        boolean mismatch = distinctAmounts.size() > 1;

        for (ExtractedEvent card : session.getTimeline()) {
            if (card.amount() == null) continue;
            QualityFlags existing = session.getQualityFlags().getOrDefault(card.eventId(), new QualityFlags(false, false, false));
            session.getQualityFlags().put(card.eventId(),
                    new QualityFlags(existing.blurry(), existing.missingDate(), mismatch));
        }
    }

    private String validateFile(MultipartFile file) {
        if (!fileValidator.hasAllowedExtension(file.getOriginalFilename())) {
            return null;
        }
        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException e) {
            return null;
        }
        return fileValidator.detectContentType(bytes);
    }
}
