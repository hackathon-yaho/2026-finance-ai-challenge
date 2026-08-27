package com.haebing.backend.timeline.service;

import com.haebing.backend.session.*;
import com.haebing.backend.timeline.dto.Gap;
import com.haebing.backend.timeline.dto.MergeRequest;
import com.haebing.backend.timeline.dto.TimelineResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class TimelineServiceImplTest {

    private final TimelineServiceImpl service = new TimelineServiceImpl();
    private Session session;

    @BeforeEach
    void setUp() {
        session = new Session("s1s1s1s1s1s1s1s1", Instant.now().plusSeconds(1800));
    }

    private ExtractedEvent card(String id, String sourceType, String occurredAt, Long amount, String actor) {
        return new ExtractedEvent(id, 0, sourceType, occurredAt, actor, "요약", amount, null, null,
                new Identifiers(null, null),
                new FieldConfidence("high", "high", "high", null, null), null, ExtractedEvent.PENDING);
    }

    private ExtractedEvent recurringCard(String id, String sourceType, Long amount, String actor,
                                          String first, String last) {
        return new ExtractedEvent(id, 0, sourceType, first, actor, "요약", amount, null, null,
                new Recurrence(2, "monthly", first, last),
                new Identifiers(null, null),
                new FieldConfidence("high", "high", "high", null, null), null, ExtractedEvent.PENDING);
    }

    @Test
    void getTimeline_sortsByOccurredAtAscending() {
        session.upsertCard(card("evt_2", "bank", "2026-09-02T10:00:00+09:00", 1000L, "self"));
        session.upsertCard(card("evt_1", "chat", "2026-09-01T10:00:00+09:00", 1000L, "self"));

        TimelineResponse response = service.getTimeline(session);

        assertThat(response.events()).extracting(ExtractedEvent::eventId).containsExactly("evt_1", "evt_2");
    }

    @Test
    void getTimeline_sameInstant_tieBreaksBySourceTypeRank() {
        String sameTime = "2026-09-01T10:00:00+09:00";
        session.upsertCard(card("evt_bank", "bank", sameTime, 1000L, "self"));
        session.upsertCard(card("evt_chat", "chat", sameTime, 2000L, "counterparty"));
        session.upsertCard(card("evt_unknown", "unknown", sameTime, 3000L, "self"));

        TimelineResponse response = service.getTimeline(session);

        assertThat(response.events()).extracting(ExtractedEvent::eventId)
                .containsExactly("evt_chat", "evt_bank", "evt_unknown");
    }

    @Test
    void getTimeline_insertsUserEnteredDueDateOnly() {
        session.getIntake().put("when", "2026-08-15");

        TimelineResponse response = service.getTimeline(session);

        assertThat(response.events()).hasSize(1);
        assertThat(response.events().get(0).eventId()).isEqualTo("evt_intake_when");
        assertThat(response.events().get(0).occurredAt()).isEqualTo("2026-08-15");
        // 2026-08-26 프론트 확인 질문 — 이 카드가 PENDING으로 나가면 게이팅에 걸린 채 풀 방법이 없어진다.
        assertThat(response.events().get(0).confirmationStatus()).isEqualTo(ExtractedEvent.USER_CONFIRMED);
        assertThat(response.events().get(0).sourceType()).isEqualTo(ExtractedEvent.SOURCE_TYPE_INTAKE);
    }

    @Test
    void mergeCandidates_withinFiveMinutesSameAmountSameActor_isCandidate() {
        session.upsertCard(card("evt_1", "chat", "2026-09-01T10:00:00+09:00", 700_000L, "self"));
        session.upsertCard(card("evt_2", "bank", "2026-09-01T10:02:00+09:00", 700_000L, "self"));

        TimelineResponse response = service.getTimeline(session);

        assertThat(response.mergeCandidates()).hasSize(1);
        assertThat(response.mergeCandidates().get(0).eventIds()).containsExactlyInAnyOrder("evt_1", "evt_2");
        assertThat(response.mergeCandidates().get(0).reason()).contains("시각 차 2분").contains("700,000원");
    }

    @Test
    void mergeCandidates_beyondFiveMinutes_notCandidate() {
        session.upsertCard(card("evt_1", "chat", "2026-09-01T10:00:00+09:00", 700_000L, "self"));
        session.upsertCard(card("evt_2", "bank", "2026-09-01T10:06:00+09:00", 700_000L, "self"));

        assertThat(service.getTimeline(session).mergeCandidates()).isEmpty();
    }

    @Test
    void mergeCandidates_differentAmount_notCandidate() {
        session.upsertCard(card("evt_1", "chat", "2026-09-01T10:00:00+09:00", 700_000L, "self"));
        session.upsertCard(card("evt_2", "bank", "2026-09-01T10:01:00+09:00", 650_000L, "self"));

        assertThat(service.getTimeline(session).mergeCandidates()).isEmpty();
    }

    @Test
    void mergeCandidates_singleCardWithinRecurrenceRange_isCandidate() {
        session.upsertCard(recurringCard("evt_recur", "autopay", 128_640L, "self",
                "2026-01-15T09:00:00+09:00", "2026-12-15T09:00:00+09:00"));
        session.upsertCard(card("evt_single", "autopay", "2026-07-15T09:00:00+09:00", 128_640L, "self"));

        TimelineResponse response = service.getTimeline(session);

        assertThat(response.mergeCandidates()).hasSize(1);
        assertThat(response.mergeCandidates().get(0).eventIds())
                .containsExactlyInAnyOrder("evt_recur", "evt_single");
        assertThat(response.mergeCandidates().get(0).reason()).contains("반복 구간");
    }

    @Test
    void mergeCandidates_singleCardOutsideRecurrenceRange_notCandidate() {
        session.upsertCard(recurringCard("evt_recur", "autopay", 128_640L, "self",
                "2026-01-15T09:00:00+09:00", "2026-12-15T09:00:00+09:00"));
        session.upsertCard(card("evt_single", "autopay", "2027-01-15T09:00:00+09:00", 128_640L, "self"));

        assertThat(service.getTimeline(session).mergeCandidates()).isEmpty();
    }

    @Test
    void mergeCandidates_singleCardWithoutOccurredAt_notCandidateEvenWithinRecurrenceWindow() {
        // 연도 없는 캡처(occurred_at == null)는 포함 관계를 판정할 수 없다 — 말하지 않은 시각을 만들지 않는다.
        session.upsertCard(recurringCard("evt_recur", "autopay", 128_640L, "self",
                "2026-01-15T09:00:00+09:00", "2026-12-15T09:00:00+09:00"));
        session.upsertCard(card("evt_single", "autopay", null, 128_640L, "self"));

        assertThat(service.getTimeline(session).mergeCandidates()).isEmpty();
    }

    @Test
    void approveMerge_rejected_excludedFromFutureCandidates() {
        session.upsertCard(card("evt_1", "chat", "2026-09-01T10:00:00+09:00", 700_000L, "self"));
        session.upsertCard(card("evt_2", "bank", "2026-09-01T10:02:00+09:00", 700_000L, "self"));
        String groupId = service.getTimeline(session).mergeCandidates().get(0).groupId();

        TimelineResponse afterReject = service.approveMerge(session, new MergeRequest(List.of(groupId), false));

        assertThat(afterReject.mergeCandidates()).isEmpty();
        assertThat(afterReject.events()).hasSize(2); // 이벤트는 그대로 둔다
    }

    @Test
    void approveMerge_approved_keepsEarlierEventHidesLater() {
        session.upsertCard(card("evt_1", "chat", "2026-09-01T10:00:00+09:00", 700_000L, "self"));
        session.upsertCard(card("evt_2", "bank", "2026-09-01T10:02:00+09:00", 700_000L, "self"));
        String groupId = service.getTimeline(session).mergeCandidates().get(0).groupId();

        TimelineResponse afterApprove = service.approveMerge(session, new MergeRequest(List.of(groupId), true));

        assertThat(afterApprove.events()).extracting(ExtractedEvent::eventId).containsExactly("evt_1");
        assertThat(session.getTimeline()).hasSize(2); // 출처는 둘 다 보존 (session.timeline에서 지우지 않음)
    }

    @Test
    void gaps_noDeliveryEvidenceForGoodsCourier_flagsGap() {
        session.getIntake().put("kind", "goods");
        session.getIntake().put("deliveryMethod", "courier");
        session.setSignals(new Signals(false, false, true, session.getSignals().qualityFlags()));

        List<Gap> gaps = service.getTimeline(session).gaps();

        assertThat(gaps).extracting(Gap::type).contains(Gap.NO_DELIVERY_EVIDENCE);
    }

    @Test
    void gaps_noDeliveryEvidenceButInPerson_noGap() {
        session.getIntake().put("kind", "goods");
        session.getIntake().put("deliveryMethod", "in_person");
        session.setSignals(new Signals(false, false, true, session.getSignals().qualityFlags()));

        List<Gap> gaps = service.getTimeline(session).gaps();

        assertThat(gaps).extracting(Gap::type).doesNotContain(Gap.NO_DELIVERY_EVIDENCE);
    }

    @Test
    void gaps_noChatCard_flagsGap() {
        session.upsertCard(card("evt_1", "bank", "2026-09-01T10:00:00+09:00", 1000L, "self"));

        List<Gap> gaps = service.getTimeline(session).gaps();

        assertThat(gaps).extracting(Gap::type).contains(Gap.NO_CHAT_EVIDENCE);
    }

    @Test
    void gaps_hasChatCard_noGap() {
        session.upsertCard(card("evt_1", "chat", "2026-09-01T10:00:00+09:00", 1000L, "self"));

        List<Gap> gaps = service.getTimeline(session).gaps();

        assertThat(gaps).extracting(Gap::type).doesNotContain(Gap.NO_CHAT_EVIDENCE);
    }
}
