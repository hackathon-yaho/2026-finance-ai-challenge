package com.haebing.backend.timeline.service;

import com.haebing.backend.session.ExtractedEvent;
import com.haebing.backend.session.MergeCandidate;
import com.haebing.backend.session.Session;
import com.haebing.backend.session.Signals;
import com.haebing.backend.timeline.dto.Gap;
import com.haebing.backend.timeline.dto.MergeRequest;
import com.haebing.backend.timeline.dto.TimelineResponse;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import java.util.*;

/** docs/backend/phase-3-evidence-timeline.md 3-5. 전부 결정적이며 LLM을 호출하지 않는다. */
@Service
public class TimelineServiceImpl implements TimelineService {

    private static final Duration MERGE_WINDOW = Duration.ofMinutes(5);
    private static final List<String> COURIER_SUGGESTIONS = List.of("택배사 조회 화면", "수령 확인");
    private static final List<String> CHAT_SUGGESTIONS = List.of("이메일", "문자", "통화 기록");
    private static final List<String> SERVICE_SUGGESTIONS = List.of("결과물 파일", "전달 기록");

    @Override
    public TimelineResponse getTimeline(Session session) {
        List<ExtractedEvent> events = sortedVisibleEvents(session);
        List<Gap> gaps = detectGaps(session);
        List<MergeCandidate> candidates = detectMergeCandidates(session);
        return new TimelineResponse(events, gaps, candidates);
    }

    @Override
    public TimelineResponse approveMerge(Session session, MergeRequest request) {
        List<MergeCandidate> candidates = detectMergeCandidates(session);
        for (String groupId : request.mergeGroupIds()) {
            candidates.stream().filter(c -> c.groupId().equals(groupId)).findFirst().ifPresent(candidate -> {
                if (request.approved()) {
                    // 가장 이른 시각의 카드를 대표로 남기고 나머지는 타임라인 표시에서만 뺀다 (출처는 둘 다 보존).
                    List<String> ordered = new ArrayList<>(candidate.eventIds());
                    ordered.sort(Comparator.comparing(id -> session.findCard(id).map(ExtractedEvent::occurredAt).orElse("")));
                    ordered.stream().skip(1).forEach(session.getMergedAwayEventIds()::add);
                } else {
                    session.getRejectedMergeGroupIds().add(groupId);
                }
            });
        }
        return getTimeline(session);
    }

    private List<ExtractedEvent> sortedVisibleEvents(Session session) {
        List<ExtractedEvent> events = new ArrayList<>();
        for (ExtractedEvent e : session.getTimeline()) {
            if (!session.getMergedAwayEventIds().contains(e.eventId())) {
                events.add(e);
            }
        }
        addSyntheticDueDateEvent(session, events);
        events.sort(Comparator
                .comparing(ExtractedEvent::occurredAt, Comparator.nullsLast(Comparator.naturalOrder()))
                .thenComparingInt(e -> ExtractedEvent.sourceTypeRank(e.sourceType())));
        return events;
    }

    /** F5-01 — 사용자가 입력한 지급정지일만 이벤트로 삽입한다(문진 응답에서 날짜를 역산하지 않는다). */
    private void addSyntheticDueDateEvent(Session session, List<ExtractedEvent> events) {
        String when = session.getIntake().get("when");
        if (when == null || when.isBlank()) return;
        if (events.stream().anyMatch(e -> ExtractedEvent.EVENT_ID_INTAKE_WHEN.equals(e.eventId()))) return;

        events.add(ExtractedEvent.intakeDueDateEvent(when));
    }

    /** F5-03 증거 공백 탐지 3종. */
    private List<Gap> detectGaps(Session session) {
        List<Gap> gaps = new ArrayList<>();
        Signals signals = session.getSignals();
        Map<String, String> intake = session.getIntake();
        String kind = intake.get("kind");
        String deliveryMethod = intake.get("deliveryMethod");
        String usage = intake.get("usage");

        if (!signals.deliveryEvidence()) {
            if ("goods".equals(kind) && !"in_person".equals(deliveryMethod)) {
                gaps.add(new Gap(Gap.NO_DELIVERY_EVIDENCE, "발송 증빙 없음", COURIER_SUGGESTIONS));
            } else if ("service".equals(kind)) {
                gaps.add(new Gap(Gap.NO_SERVICE_EVIDENCE, "용역 증빙 없음", SERVICE_SUGGESTIONS));
            }
        }

        if (!signals.lifeActivity() && !"main".equals(usage)) {
            gaps.add(new Gap(Gap.NO_LIFE_ACTIVITY, "생계 흔적 없음", List.of()));
        }

        boolean hasChat = session.getTimeline().stream().anyMatch(e -> "chat".equals(e.sourceType()));
        if (!hasChat) {
            gaps.add(new Gap(Gap.NO_CHAT_EVIDENCE, "거래 합의 증빙 없음", CHAT_SUGGESTIONS));
        }
        return gaps;
    }

    /** F5-02 — 시각 차 5분 이내 + 금액 일치 + actor 동일. 자동 확정하지 않고 후보만 만든다. */
    private List<MergeCandidate> detectMergeCandidates(Session session) {
        List<ExtractedEvent> cards = session.getTimeline().stream()
                .filter(e -> !session.getMergedAwayEventIds().contains(e.eventId()))
                .filter(e -> e.amount() != null && e.actor() != null && parseInstant(e.occurredAt()) != null)
                .toList();

        List<MergeCandidate> candidates = new ArrayList<>();
        for (int i = 0; i < cards.size(); i++) {
            for (int j = i + 1; j < cards.size(); j++) {
                ExtractedEvent a = cards.get(i);
                ExtractedEvent b = cards.get(j);
                if (!a.amount().equals(b.amount()) || !a.actor().equals(b.actor())) continue;

                Duration diff = Duration.between(parseInstant(a.occurredAt()), parseInstant(b.occurredAt())).abs();
                if (diff.compareTo(MERGE_WINDOW) > 0) continue;

                List<String> pair = new ArrayList<>(List.of(a.eventId(), b.eventId()));
                Collections.sort(pair);
                String groupId = "mg_" + pair.get(0) + "_" + pair.get(1);
                if (session.getRejectedMergeGroupIds().contains(groupId)) continue;

                String reason = "시각 차 %d분 · 금액 %,d원 일치 · actor 동일".formatted(diff.toMinutes(), a.amount());
                candidates.add(new MergeCandidate(groupId, pair, reason));
            }
        }
        return candidates;
    }

    private java.time.Instant parseInstant(String occurredAt) {
        if (occurredAt == null) return null;
        try {
            return OffsetDateTime.parse(occurredAt).toInstant();
        } catch (DateTimeParseException e) {
            return null; // 날짜만 있고 시각이 없는 값 — 병합 판정에서 제외한다 (말하지 않은 시각을 만들지 않음)
        }
    }
}
