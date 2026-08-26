package com.haebing.backend.textpackage.service;

import com.haebing.backend.common.global.ErrorCode;
import com.haebing.backend.common.global.exception.BusinessException;
import com.haebing.backend.session.ExtractedEvent;
import com.haebing.backend.session.Recurrence;
import com.haebing.backend.session.Session;
import com.haebing.backend.session.StoredSentence;
import com.haebing.backend.textpackage.dto.Account;
import com.haebing.backend.textpackage.dto.Applicant;
import com.haebing.backend.textpackage.dto.PackageRequest;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** docs/backend/phase-5-draft-package.md 5-4. */
@Service
public class PackageServiceImpl implements PackageService {

    private static final int MAX_FIELD_LENGTH = 100;
    private static final Map<String, String> SOURCE_TYPE_LABELS = Map.of(
            "chat", "대화", "bank", "입금 내역", "shipping", "배송", "threat", "협박", "autopay", "자동이체",
            "unknown", "기타", ExtractedEvent.SOURCE_TYPE_INTAKE, "본인 입력"
    );
    private static final Map<String, String> RECURRENCE_PERIOD_LABELS = Map.of(
            "monthly", "매월", "weekly", "매주", "daily", "매일", "other", "주기적으로"
    );

    @Override
    public byte[] generate(Session session, PackageRequest request) {
        validate(request);
        Set<String> excluded = request.excludedSentenceIds() == null ? Set.of() : Set.copyOf(request.excludedSentenceIds());

        List<ExtractedEvent> confirmed = session.getTimeline().stream().filter(this::isConfirmed).toList();
        String footer = "AI 초안 · 사용자 확인 완료 " + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm"))
                + " · 최종 판단은 금융회사";
        String statementText = buildStatementText(session, excluded);

        try (PdfBuilder builder = new PdfBuilder()) {
            builder.addCoverPage();
            builder.addPage1(request.applicant(), request.account(), statementText, LocalDate.now());
            builder.addPage2(statementText, footer);
            builder.addPage3(buildTimelineRows(withIntakeDueDateEvent(session, confirmed)), footer);
            builder.addPage4(buildEvidenceRows(confirmed), footer);
            return builder.build();
        } catch (IOException e) {
            throw new IllegalStateException("PDF 생성에 실패했습니다", e);
        }
    }

    /**
     * 3면 전용 — `/api/timeline`(TimelineServiceImpl)과 같은 지급정지일 합성 카드를 여기서도 넣는다.
     * 2026-08-26 계약 확정(local-integration-findings.md §4): 미리보기(3면)와는 같아야 하지만,
     * 4면(증빙목록)은 실제로 올린 자료만 다루므로 이 카드를 넣지 않는다 — 그래서 `confirmed`(4면용)가 아니라
     * 별도 리스트로만 합성한다.
     */
    private List<ExtractedEvent> withIntakeDueDateEvent(Session session, List<ExtractedEvent> confirmed) {
        String when = session.getIntake().get("when");
        if (when == null || when.isBlank()) return confirmed;
        if (confirmed.stream().anyMatch(e -> ExtractedEvent.EVENT_ID_INTAKE_WHEN.equals(e.eventId()))) return confirmed;

        List<ExtractedEvent> withSynthetic = new java.util.ArrayList<>(confirmed);
        withSynthetic.add(ExtractedEvent.intakeDueDateEvent(when));
        return withSynthetic;
    }

    /**
     * 2면 — 이 요청의 excludedSentenceIds만 본다(2026-08-26 프론트 회신으로 확정: 요청 값이 최종).
     * session의 StoredSentence.excluded()는 /api/draft·/api/draft/revise 응답 배열에서만 쓰고 여기서는 안 본다 —
     * 프론트가 제외 토글마다 revise를 부르지 않고 다운로드 직전 이 필드 하나로 최종 목록을 보내는 구조이기 때문이다.
     * 존재하지 않는 id는 무시한다.
     */
    private String buildStatementText(Session session, Set<String> excludedSentenceIds) {
        return session.getSentences().stream()
                .filter(s -> !excludedSentenceIds.contains(s.sentenceId()))
                .map(StoredSentence::text)
                .reduce((a, b) -> a + " " + b)
                .orElse("");
    }

    /** 3면 — F5-01과 같은 정렬(occurred_at 오름차순, 동시각은 source_type tie-break). */
    private List<TimelineRow> buildTimelineRows(List<ExtractedEvent> confirmed) {
        return confirmed.stream()
                .sorted(Comparator
                        .comparing(ExtractedEvent::occurredAt, Comparator.nullsLast(Comparator.naturalOrder()))
                        .thenComparingInt(e -> ExtractedEvent.sourceTypeRank(e.sourceType())))
                .map(e -> new TimelineRow(
                        formatOccurredAt(e.occurredAt()),
                        actorLabel(e.actor()),
                        e.recurrence() == null ? e.summary() : e.summary() + " (" + recurrenceCountLabel(e.recurrence()) + ")",
                        formatAmount(e.amount(), e.recurrence())))
                .toList();
    }

    /**
     * internal-api-contract.md "recurrence" §"3면·4면 표기" — 반복 카드는 `amount`가 1회분이라 그대로
     * 찍으면 "총액 6만원짜리 거래 1건"으로 읽힌다(요청 문서 실측). "(1회분)"을 붙여 오독을 막는다.
     */
    private String formatAmount(Long amount, Recurrence recurrence) {
        if (amount == null) return "미상";
        String formatted = String.format("%,d원", amount);
        return recurrence == null ? formatted : formatted + " (1회분)";
    }

    /** "매월 12회" — count는 AI-server가 계산한 값을 그대로 신뢰한다(해석하지 않음). 기간(첫~마지막)은 occurredAt 열에 이미 있어 여기서 반복하지 않는다. */
    private String recurrenceCountLabel(Recurrence r) {
        String period = RECURRENCE_PERIOD_LABELS.getOrDefault(r.period(), "주기적으로");
        return period + " " + r.count() + "회";
    }

    /**
     * 4면 — "올린 자료의 목차"라 카드 단위가 아니라 **첨부(원본) 단위로 한 줄**이다(2026-08-26 개선).
     * 카드 단위였을 때는 3면(타임라인)과 열만 다를 뿐 사실상 같은 표였다 — 캡처 한 장에서 카드가
     * 여러 개 나오면(예: 대화 캡처 한 장 → 3장) 3면·4면에 똑같이 여러 줄로 흩어져 "내가 뭘 제출했는지"에
     * 답이 안 됐다. source_image_index 오름차순(null=본인 입력 텍스트는 맨 뒤)으로 묶는다.
     */
    private List<EvidenceRow> buildEvidenceRows(List<ExtractedEvent> confirmed) {
        Map<Integer, List<ExtractedEvent>> byOrigin = new java.util.LinkedHashMap<>();
        for (ExtractedEvent e : confirmed) {
            int key = e.sourceImageIndex() == null ? Integer.MAX_VALUE : e.sourceImageIndex();
            byOrigin.computeIfAbsent(key, k -> new java.util.ArrayList<>()).add(e);
        }
        List<Integer> keys = new java.util.ArrayList<>(byOrigin.keySet());
        keys.sort(Comparator.naturalOrder());

        List<EvidenceRow> rows = new java.util.ArrayList<>();
        int seq = 1;
        for (Integer key : keys) {
            List<ExtractedEvent> group = byOrigin.get(key);
            String origin = key == Integer.MAX_VALUE ? "본인 서술" : "원본 " + (key + 1) + "번"; // 0-base → 1-base
            rows.add(new EvidenceRow(seq++, SOURCE_TYPE_LABELS.getOrDefault(group.get(0).sourceType(), "기타"),
                    dateRangeLabel(group), summaryLabel(group), origin));
        }
        return rows;
    }

    /**
     * 같은 원본에서 나온 카드들의 확인된 일시 범위. 전부 시각 미상이면 그대로, 일부만 미상이면 표시해 둔다.
     * 카드가 하나뿐이고 그 카드가 반복 카드면, `occurred_at`(= 첫 회차) 대신 `recurrence.first~last`
     * 전체 기간을 보여준다 — 그러지 않으면 12번 있었던 일이 "첫 회차 1번"으로만 보인다
     * (docs/request/backend/recurrence-not-reaching-frontend.md §3).
     */
    private String dateRangeLabel(List<ExtractedEvent> group) {
        if (group.size() == 1 && group.get(0).recurrence() != null) {
            Recurrence r = group.get(0).recurrence();
            return formatOccurredAt(r.first()) + " ~ " + formatOccurredAt(r.last());
        }
        List<String> known = group.stream().map(ExtractedEvent::occurredAt).filter(java.util.Objects::nonNull).sorted().toList();
        if (known.isEmpty()) return "시각 미상";
        String first = formatOccurredAt(known.get(0));
        String last = formatOccurredAt(known.get(known.size() - 1));
        String range = first.equals(last) ? first : first + " ~ " + last;
        int unknown = group.size() - known.size();
        return unknown == 0 ? range : range + " (시각 미상 " + unknown + "건 포함)";
    }

    /**
     * 같은 원본에서 카드가 하나면 그 요약을 그대로, 여럿이면 건수만 보여준다. 대표 사실 예시를 덧붙이는
     * 안도 시도했지만, 일시 범위와 합치면 열 너비를 넘겨 "예: …"처럼 내용 없이 잘리는 줄이 나왔다
     * (2026-08-26 실측) — 4면은 목차이고 사실 내용은 3면에 있으니 굳이 욱여넣지 않는다.
     */
    private String summaryLabel(List<ExtractedEvent> group) {
        if (group.size() > 1) return group.size() + "건 확인됨";
        ExtractedEvent only = group.get(0);
        if (only.recurrence() == null) return only.summary();
        return only.summary() + " (" + recurrenceCountLabel(only.recurrence()) + ", 1회분 " + formatAmount(only.amount(), null) + ")";
    }

    /** "2026-09-01T10:00:00+09:00" → "2026-09-01 10:00". 시간대 표기가 표를 넓게 잡아먹어 사람이 읽을 형태로 줄인다. */
    private String formatOccurredAt(String occurredAt) {
        if (occurredAt == null || occurredAt.isBlank()) return "시각 미상";
        try {
            return java.time.OffsetDateTime.parse(occurredAt)
                    .format(java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm"));
        } catch (java.time.format.DateTimeParseException e) {
            return occurredAt; // 날짜만 있는 값(예: "2026-08-15") 등은 그대로 둔다
        }
    }

    private String actorLabel(String actor) {
        if ("self".equals(actor)) return "본인";
        if ("counterparty".equals(actor)) return "상대방";
        if ("system".equals(actor)) return "시스템";
        return "미상";
    }

    private boolean isConfirmed(ExtractedEvent card) {
        return ExtractedEvent.USER_CONFIRMED.equals(card.confirmationStatus())
                || ExtractedEvent.USER_CORRECTED.equals(card.confirmationStatus());
    }

    private void validate(PackageRequest request) {
        validateApplicant(request.applicant());
        validateAccount(request.account());
    }

    private void validateApplicant(Applicant a) {
        if (a == null) return;
        checkLength("applicant.name", a.name());
        checkBirthDate(a.birthDate());
        checkLength("applicant.address", a.address());
        checkLength("applicant.phone", a.phone());
        checkLength("applicant.mobile", a.mobile());
        checkLength("applicant.email", a.email());
    }

    private void validateAccount(Account a) {
        if (a == null) return;
        checkLength("account.bank", a.bank());
        checkLength("account.branch", a.branch());
        checkLength("account.depositType", a.depositType());
        checkLength("account.accountNumber", a.accountNumber());
        checkLength("account.holderName", a.holderName());
    }

    private void checkLength(String field, String value) {
        if (value != null && value.length() > MAX_FIELD_LENGTH) {
            throw new BusinessException(ErrorCode.INVALID_FORM_FIELD, field + "는 " + MAX_FIELD_LENGTH + "자를 넘을 수 없습니다");
        }
    }

    private void checkBirthDate(String birthDate) {
        if (birthDate == null || birthDate.isBlank()) return;
        if (!birthDate.matches("\\d{4}-\\d{2}-\\d{2}")) {
            throw new BusinessException(ErrorCode.INVALID_FORM_FIELD, "applicant.birthDate는 YYYY-MM-DD 형식이어야 합니다");
        }
    }
}
