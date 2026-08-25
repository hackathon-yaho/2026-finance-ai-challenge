package com.haebing.backend.readiness.service;

import com.haebing.backend.common.global.ErrorCode;
import com.haebing.backend.common.global.exception.BusinessException;
import com.haebing.backend.evidence.service.EvidenceService;
import com.haebing.backend.readiness.dto.ChecklistItem;
import com.haebing.backend.readiness.dto.ReadinessResponse;
import com.haebing.backend.readiness.dto.SelfHeldRequest;
import com.haebing.backend.session.ExtractedEvent;
import com.haebing.backend.session.Session;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

import static com.haebing.backend.readiness.dto.ChecklistItem.*;
import static com.haebing.backend.readiness.dto.ReadinessResponse.*;

/** docs/backend/phase-4-readiness.md. 제출 준비도는 AI가 하지 않는다 — 결정적 규칙만 쓴다. */
@Service
@RequiredArgsConstructor
public class ReadinessServiceImpl implements ReadinessService {

    private final ChecklistEvaluator checklistEvaluator;
    private final EvidenceService evidenceService;

    @Override
    public ReadinessResponse evaluate(Session session) {
        String reason = reasonOf(session.getIntake().get("kind"));
        List<ChecklistItem> checklist = checklistEvaluator.evaluate(session, reason);

        boolean hasUnconfirmedFields = evidenceService.hasAnyPendingCard(session);
        boolean hasMissingRequiredEvidence = hasBlockingGap(checklist);
        boolean hasConflicts = hasAmountMismatch(session);
        boolean hasUnknownBankCriteria = "true".equals(session.getIntake().get("history"));

        String readiness;
        if (hasUnconfirmedFields || hasMissingRequiredEvidence) {
            readiness = SUPPLEMENT_NEEDED;
        } else if (hasConflicts || hasUnknownBankCriteria) {
            readiness = BANK_CHECK_REQUIRED;
        } else {
            readiness = SUBMISSION_READY;
        }

        List<String> missingItems = missingItemLabels(checklist);
        List<String> conflicts = hasConflicts ? List.of(NoticeTexts.CONFLICT_AMOUNT_MISMATCH) : List.of();
        List<String> notices = buildNotices(hasUnconfirmedFields, blockingItemLabels(checklist), hasUnknownBankCriteria);

        return new ReadinessResponse(reason, checklist, readiness, missingItems, conflicts, notices,
                NoticeTexts.SMALL_AMOUNT_NOTICE, session.getSignals().threatDetected());
    }

    @Override
    public List<ChecklistItem> selfHeld(Session session, SelfHeldRequest request) {
        String reason = reasonOf(session.getIntake().get("kind"));
        if (!itemExists(reason, request.itemId())) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST, "존재하지 않는 itemId입니다: " + request.itemId());
        }
        session.getSelfHeldItems().put(request.itemId(), request.held());
        return checklistEvaluator.evaluate(session, reason);
    }

    /** F6-01 — 문진 응답을 그대로 매핑한다. 추론하지 않는다. */
    private String reasonOf(String kind) {
        if ("goods".equals(kind) || "service".equals(kind) || "debt".equals(kind)) {
            return kind;
        }
        return "unclear"; // kind==unclear 이거나, 문진 미응답
    }

    private boolean itemExists(String reason, String itemId) {
        for (ChecklistEntry entry : ChecklistCatalog.forReason(reason)) {
            if (entry.id().equals(itemId)) return true;
            if (entry.options() != null && entry.options().stream().anyMatch(o -> o.id().equals(itemId))) return true;
        }
        return false;
    }

    private boolean hasBlockingGap(List<ChecklistItem> checklist) {
        for (ChecklistItem item : checklist) {
            if (!WHEN_MISSING_BLOCKS.equals(item.whenMissing())) continue;
            if (!STATUS_MET.equals(item.status())) return true;
        }
        return false;
    }

    private boolean hasAmountMismatch(Session session) {
        for (ExtractedEvent card : session.getTimeline()) {
            var flags = session.getQualityFlags().get(card.eventId());
            if (flags != null && flags.amountMismatch()) return true;
        }
        return false;
    }

    private List<String> missingItemLabels(List<ChecklistItem> checklist) {
        List<String> labels = new ArrayList<>();
        for (ChecklistItem item : checklist) {
            if (WHEN_MISSING_SILENT.equals(item.whenMissing())) continue;
            if (!STATUS_MET.equals(item.status())) labels.add(item.label());
        }
        return labels;
    }

    /** F6-06 근거 설명은 "보완 필요"를 직접 일으키는 blocks 항목만 대상으로 한다 — notice 항목까지 다 나열하지 않는다. */
    private List<String> blockingItemLabels(List<ChecklistItem> checklist) {
        List<String> labels = new ArrayList<>();
        for (ChecklistItem item : checklist) {
            if (WHEN_MISSING_BLOCKS.equals(item.whenMissing()) && !STATUS_MET.equals(item.status())) {
                labels.add(item.label());
            }
        }
        return labels;
    }

    private List<String> buildNotices(boolean hasUnconfirmedFields, List<String> blockingLabels, boolean hasHistory) {
        List<String> notices = new ArrayList<>();
        notices.add(NoticeTexts.FINAL_DECISION_BY_BANK);
        if (hasUnconfirmedFields) {
            notices.add(NoticeTexts.unconfirmedFieldsExplanation());
        }
        for (String label : blockingLabels) {
            notices.add(NoticeTexts.missingEvidenceExplanation(label));
        }
        if (hasHistory) {
            notices.add(NoticeTexts.HISTORY_NOTICE);
        }
        return notices;
    }
}
