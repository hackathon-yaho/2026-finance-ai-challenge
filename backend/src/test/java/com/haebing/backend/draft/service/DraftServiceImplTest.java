package com.haebing.backend.draft.service;

import com.haebing.backend.ai.AiClient;
import com.haebing.backend.ai.dto.DraftRequest;
import com.haebing.backend.ai.dto.DraftResult;
import com.haebing.backend.ai.dto.DraftSentence;
import com.haebing.backend.ai.dto.EvidenceRef;
import com.haebing.backend.common.global.exception.BusinessException;
import com.haebing.backend.draft.dto.DraftResponse;
import com.haebing.backend.draft.dto.ReviseRequest;
import com.haebing.backend.draft.dto.ReviseResponse;
import com.haebing.backend.draft.dto.ReviseSentenceInput;
import com.haebing.backend.readiness.dto.ReadinessResponse;
import com.haebing.backend.readiness.service.ReadinessService;
import com.haebing.backend.session.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/** docs/backend/phase-5-draft-package.md "단위 테스트 (Phase 5 범위)". */
class DraftServiceImplTest {

    private final AiClient aiClient = mock(AiClient.class);
    private final ReadinessService readinessService = mock(ReadinessService.class);
    private final DraftServiceImpl service = new DraftServiceImpl(aiClient, readinessService);

    private Session session;

    @BeforeEach
    void setUp() {
        session = new Session("s1s1s1s1s1s1s1s1", Instant.now().plusSeconds(1800));
        when(readinessService.evaluate(any())).thenReturn(
                new ReadinessResponse("goods", List.of(), ReadinessResponse.SUBMISSION_READY,
                        List.of(), List.of(), List.of(), "notice", false));
    }

    private ExtractedEvent card(String id, String status) {
        return new ExtractedEvent(id, 0, "chat", "2026-09-01T00:00:00+09:00", "self", "요약", 1000L,
                null, null, new Identifiers(null, null),
                new FieldConfidence("high", "high", "high", null, null), null, status);
    }

    private DraftResult successResult() {
        return new DraftResult("본문", List.of(
                new DraftSentence("s1", "문장1", List.of(new EvidenceRef("evidence", 0, new SourceRegion(0, 0, 1, 1))))
        ), true);
    }

    @Test
    void generate_onlyConfirmedCardsSentToAiServer() {
        session.upsertCard(card("evt_1", ExtractedEvent.USER_CONFIRMED));
        session.upsertCard(card("evt_2", ExtractedEvent.PENDING));
        when(aiClient.draft(any())).thenReturn(successResult());

        service.generate(session);

        org.mockito.ArgumentCaptor<DraftRequest> captor = org.mockito.ArgumentCaptor.forClass(DraftRequest.class);
        verify(aiClient).draft(captor.capture());
        assertThat(captor.getValue().events()).extracting(ExtractedEvent::eventId).containsExactly("evt_1");
    }

    @Test
    void generate_factCheckFailedOnce_retriesOnceThenReturns() {
        DraftResult failed = new DraftResult("실패본문", List.of(), false);
        when(aiClient.draft(any())).thenReturn(failed).thenReturn(successResult());

        DraftResponse response = service.generate(session);

        verify(aiClient, times(2)).draft(any());
        assertThat(response.draftText()).isEqualTo("본문");
    }

    @Test
    void generate_factCheckFailedTwice_returnsSecondAttemptWithoutThirdCall() {
        DraftResult failed = new DraftResult("실패본문", List.of(), false);
        when(aiClient.draft(any())).thenReturn(failed);

        DraftResponse response = service.generate(session);

        verify(aiClient, times(2)).draft(any()); // 무한 루프 없음 — 딱 2번
        assertThat(response.draftText()).isEqualTo("실패본문");
    }

    @Test
    void generate_storesSentencesAndEvidenceInSession() {
        when(aiClient.draft(any())).thenReturn(successResult());

        service.generate(session);

        assertThat(session.findSentence("s1")).isPresent();
        assertThat(session.getSentenceEvidence()).hasSize(1);
        assertThat(session.getSentenceEvidence().get(0).type()).isEqualTo("evidence");
    }

    @Test
    void revise_textChange_downgradesToUserTextWithWarning() {
        when(aiClient.draft(any())).thenReturn(successResult());
        service.generate(session);

        ReviseResponse response = service.revise(session,
                new ReviseRequest(List.of(new ReviseSentenceInput("s1", "고친 문장", null))));

        assertThat(response.warning()).contains("본인 진술");
        DraftSentence revised = response.sentences().get(0);
        assertThat(revised.text()).isEqualTo("고친 문장");
        assertThat(revised.evidenceRefs()).extracting(EvidenceRef::type).containsExactly("user_text");
    }

    @Test
    void revise_excludeTrue_removedFromResponseButNotDeleted() {
        when(aiClient.draft(any())).thenReturn(successResult());
        service.generate(session);

        ReviseResponse response = service.revise(session,
                new ReviseRequest(List.of(new ReviseSentenceInput("s1", null, true))));

        assertThat(response.sentences()).isEmpty(); // 최종 문서에서도 빠지므로 미리보기에서 뺀다
        assertThat(session.findSentence("s1")).isPresent(); // 삭제는 아니다 — 되돌릴 수 있음
        assertThat(session.findSentence("s1").get().excluded()).isTrue();
    }

    @Test
    void revise_unknownSentenceId_rejected() {
        assertThatThrownBy(() -> service.revise(session,
                new ReviseRequest(List.of(new ReviseSentenceInput("no-such", "x", null)))))
                .isInstanceOf(BusinessException.class);
    }

}
