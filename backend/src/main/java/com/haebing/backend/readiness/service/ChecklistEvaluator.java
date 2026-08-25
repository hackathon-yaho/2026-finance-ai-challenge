package com.haebing.backend.readiness.service;

import com.haebing.backend.readiness.dto.ChecklistItem;
import com.haebing.backend.readiness.dto.ChecklistOption;
import com.haebing.backend.session.ExtractedEvent;
import com.haebing.backend.session.Session;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

import static com.haebing.backend.readiness.dto.ChecklistItem.*;

/**
 * docs/backend/phase-4-readiness.md 4-3 · 4-3a. 카탈로그 원소를 세션 상태로 판정한다.
 * F6-03 — 입력은 confirmed(user_confirmed/user_corrected) 카드뿐이다. 미확인 카드는 근거로 쓰지 않는다.
 */
@Component
public class ChecklistEvaluator {

    public List<ChecklistItem> evaluate(Session session, String reason) {
        Set<String> confirmedSourceTypes = confirmedSourceTypes(session);
        boolean hasAnyConfirmedCard = session.getTimeline().stream().anyMatch(this::isConfirmed);
        String deliveryMethod = session.getIntake().get("deliveryMethod");

        List<ChecklistItem> result = new ArrayList<>();
        for (ChecklistEntry entry : ChecklistCatalog.forReason(reason)) {
            result.add(evaluateEntry(entry, session, confirmedSourceTypes, hasAnyConfirmedCard, deliveryMethod));
        }
        return result;
    }

    private ChecklistItem evaluateEntry(ChecklistEntry entry, Session session, Set<String> confirmedSourceTypes,
                                         boolean hasAnyConfirmedCard, String deliveryMethod) {
        if (ChecklistCatalog.PAYER_MATCH_ID.equals(entry.id())) {
            return evaluatePayerMatch(entry, session);
        }

        // F5-03 직거래 예외와 같은 이유 — spec.md "체크리스트의 goods.delivery 라벨도 in_person이면 바뀐다"
        if ("goods.delivery".equals(entry.id()) && "in_person".equals(deliveryMethod)) {
            return new ChecklistItem(entry.id(), "물품 사진 · 거래 장소·시각을 보이는 자료 · 대면 인도 정황",
                    entry.tier(), entry.fulfillBy(), entry.whenMissing(), STATUS_UNMET,
                    "직거래는 택배 송장이 없어요. 이런 자료가 있으면 도움이 돼요.", null);
        }

        if (entry.options() != null) {
            List<ChecklistOption> options = entry.options().stream()
                    .map(opt -> new ChecklistOption(opt.id(), opt.label(),
                            statusOf(entry.fulfillBy(), opt.sources(), session, confirmedSourceTypes, hasAnyConfirmedCard, opt.id())))
                    .toList();
            String groupStatus = options.stream().anyMatch(o -> STATUS_MET.equals(o.status())) ? STATUS_MET : STATUS_UNMET;
            return new ChecklistItem(entry.id(), entry.label(), entry.tier(), entry.fulfillBy(), entry.whenMissing(),
                    groupStatus, entry.note(), options);
        }

        String status = statusOf(entry.fulfillBy(), entry.sources(), session, confirmedSourceTypes, hasAnyConfirmedCard, entry.id());
        return new ChecklistItem(entry.id(), entry.label(), entry.tier(), entry.fulfillBy(), entry.whenMissing(),
                status, entry.note(), null);
    }

    private String statusOf(String fulfillBy, List<String> sources, Session session,
                             Set<String> confirmedSourceTypes, boolean hasAnyConfirmedCard, String itemId) {
        if (FULFILL_SELF.equals(fulfillBy)) {
            return Boolean.TRUE.equals(session.getSelfHeldItems().get(itemId)) ? STATUS_MET : STATUS_UNMET;
        }
        // FULFILL_UPLOAD
        if (ChecklistCatalog.LEGAL_PROOF_ID.equals(itemId)) {
            return hasAnyConfirmedCard ? STATUS_MET : STATUS_UNMET; // 자유 형식 — 확인된 자료가 하나라도 있으면 충족
        }
        boolean met = sources != null && sources.stream().anyMatch(confirmedSourceTypes::contains);
        return met ? STATUS_MET : STATUS_UNMET;
    }

    /**
     * reason-type-rules.md §2-1 — 구매자–송금인 이름 대조. 결정적 규칙, AI는 판정하지 않는다.
     * 둘 다 값이 있을 때만 대조한다. 한쪽이라도 null이면 UNKNOWN이지 불일치가 아니다.
     */
    private ChecklistItem evaluatePayerMatch(ChecklistEntry entry, Session session) {
        List<String> counterpartyNames = confirmedValues(session, ExtractedEvent::counterpartyName);
        List<String> payerNames = confirmedValues(session, ExtractedEvent::payerName);

        String status;
        String note = entry.note();
        if (counterpartyNames.isEmpty() || payerNames.isEmpty()) {
            status = STATUS_UNKNOWN;
        } else {
            boolean anyMatch = counterpartyNames.stream()
                    .anyMatch(c -> payerNames.stream().anyMatch(p -> normalize(c).equals(normalize(p))));
            if (anyMatch) {
                status = STATUS_MET;
            } else {
                status = STATUS_NEEDS_EXPLANATION;
                note = "이름이 다르게 확인됐어요. 소명서에 설명이 필요할 수 있어요 — 위험 신호는 아니에요.";
            }
        }
        return new ChecklistItem(entry.id(), entry.label(), entry.tier(), entry.fulfillBy(), entry.whenMissing(),
                status, note, null);
    }

    private List<String> confirmedValues(Session session, java.util.function.Function<ExtractedEvent, String> extractor) {
        return session.getTimeline().stream()
                .filter(this::isConfirmed)
                .map(extractor)
                .filter(v -> v != null && !v.isBlank())
                .toList();
    }

    /** 공백·가운뎃점 제거 후 완전 일치. 부분 일치·유사도는 넣지 않는다 (오탐 방지). */
    private String normalize(String name) {
        return name.replaceAll("[\\s·]", "");
    }

    private Set<String> confirmedSourceTypes(Session session) {
        return session.getTimeline().stream()
                .filter(this::isConfirmed)
                .map(ExtractedEvent::sourceType)
                .filter(java.util.Objects::nonNull)
                .collect(java.util.stream.Collectors.toSet());
    }

    private boolean isConfirmed(ExtractedEvent card) {
        return ExtractedEvent.USER_CONFIRMED.equals(card.confirmationStatus())
                || ExtractedEvent.USER_CORRECTED.equals(card.confirmationStatus());
    }
}
