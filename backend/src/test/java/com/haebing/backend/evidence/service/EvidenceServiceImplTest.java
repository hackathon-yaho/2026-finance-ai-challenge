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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

class EvidenceServiceImplTest {

    private final FileValidator fileValidator = mock(FileValidator.class);
    private final AiClient aiClient = mock(AiClient.class);
    private final EvidenceServiceImpl service = new EvidenceServiceImpl(fileValidator, aiClient);
    private Session session;

    @BeforeEach
    void setUp() {
        session = new Session("s1s1s1s1s1s1s1s1", Instant.now().plusSeconds(1800));
        when(fileValidator.hasAllowedExtension(anyString())).thenReturn(true);
        when(fileValidator.detectContentType(any())).thenReturn("image/png");
    }

    private ExtractedEvent card(String id, Integer imageIndex, Long amount, String status) {
        return new ExtractedEvent(id, imageIndex, "chat", "2026-09-01T00:00:00+09:00", "self", "요약", amount,
                null, null, new Identifiers(null, null),
                new FieldConfidence("high", "high", "high", null, null), null, status);
    }

    private MockMultipartFile file(String name) {
        return new MockMultipartFile(name, name, "image/png", new byte[]{1, 2, 3});
    }

    @Test
    void uploadImages_amountsDiffer_marksAmountMismatchOnAllAmountCards() {
        when(aiClient.extractFromImage(any(), eq(0), any()))
                .thenReturn(new ExtractResult(List.of(card("evt_0_1", 0, 700_000L, ExtractedEvent.PENDING)),
                        Signals.empty(), Map.of()));
        when(aiClient.extractFromImage(any(), eq(1), any()))
                .thenReturn(new ExtractResult(List.of(card("evt_1_1", 1, 650_000L, ExtractedEvent.PENDING)),
                        Signals.empty(), Map.of()));

        service.uploadImages(session, List.of(file("a.png"), file("b.png")), List.of(0, 1));
        service.uploadImages(session, List.of(file("c.png")), List.of(1)); // 재추출 대신 두 번째 호출로 흉내

        assertThat(session.getQualityFlags().get("evt_0_1").amountMismatch()).isTrue();
        assertThat(session.getQualityFlags().get("evt_1_1").amountMismatch()).isTrue();
    }

    @Test
    void uploadImages_amountsMatch_noMismatch() {
        when(aiClient.extractFromImage(any(), eq(0), any()))
                .thenReturn(new ExtractResult(List.of(card("evt_0_1", 0, 700_000L, ExtractedEvent.PENDING)),
                        Signals.empty(), Map.of()));
        when(aiClient.extractFromImage(any(), eq(1), any()))
                .thenReturn(new ExtractResult(List.of(card("evt_1_1", 1, 700_000L, ExtractedEvent.PENDING)),
                        Signals.empty(), Map.of()));

        service.uploadImages(session, List.of(file("a.png"), file("b.png")), List.of(0, 1));

        assertThat(session.getQualityFlags().get("evt_0_1").amountMismatch()).isFalse();
        assertThat(session.getQualityFlags().get("evt_1_1").amountMismatch()).isFalse();
    }

    /** 재계산 전 스냅샷이 아니라 세션에 반영된 최신 값이 이 호출의 응답에도 실려야 한다. */
    @Test
    void uploadImages_amountMismatch_reflectedInThisCallsResponseNotJustSession() {
        when(aiClient.extractFromImage(any(), eq(0), any()))
                .thenReturn(new ExtractResult(List.of(card("evt_0_1", 0, 700_000L, ExtractedEvent.PENDING)),
                        Signals.empty(), Map.of("evt_0_1", new QualityFlags(false, false, false))));
        service.uploadImages(session, List.of(file("a.png")), List.of(0));

        when(aiClient.extractFromImage(any(), eq(1), any()))
                .thenReturn(new ExtractResult(List.of(card("evt_1_1", 1, 450_000L, ExtractedEvent.PENDING)),
                        Signals.empty(), Map.of("evt_1_1", new QualityFlags(false, false, false))));
        ExtractResult response = service.uploadImages(session, List.of(file("b.png")), List.of(1));

        assertThat(response.qualityFlags().get("evt_1_1").amountMismatch()).isTrue();
        assertThat(session.getQualityFlags().get("evt_1_1").amountMismatch()).isTrue();
    }

    @Test
    void uploadText_amountMismatch_reflectedInThisCallsResponseNotJustSession() {
        when(aiClient.extractFromImage(any(), eq(0), any()))
                .thenReturn(new ExtractResult(List.of(card("evt_0_1", 0, 700_000L, ExtractedEvent.PENDING)),
                        Signals.empty(), Map.of("evt_0_1", new QualityFlags(false, false, false))));
        service.uploadImages(session, List.of(file("a.png")), List.of(0));

        when(aiClient.extractFromText(anyString()))
                .thenReturn(new ExtractResult(List.of(card("evt_text_1", null, 450_000L, ExtractedEvent.PENDING)),
                        Signals.empty(), Map.of("evt_text_1", new QualityFlags(false, false, false))));
        ExtractResult response = service.uploadText(session, "본문");

        assertThat(response.qualityFlags().get("evt_text_1").amountMismatch()).isTrue();
        assertThat(session.getQualityFlags().get("evt_text_1").amountMismatch()).isTrue();
    }

    @Test
    void uploadImages_invalidFileAmongValid_skipsInvalidKeepsValid() {
        when(fileValidator.detectContentType(any())).thenReturn("image/png", (String) null);
        when(aiClient.extractFromImage(any(), eq(0), any()))
                .thenReturn(new ExtractResult(List.of(card("evt_0_1", 0, 1000L, ExtractedEvent.PENDING)),
                        Signals.empty(), Map.of()));

        ExtractResult result = service.uploadImages(session, List.of(file("good.png"), file("bad.png")), List.of(0, 1));

        assertThat(result.cards()).hasSize(1);
        verify(aiClient, never()).extractFromImage(any(), eq(1), any());
    }

    @Test
    void uploadImages_allFilesInvalid_throwsInvalidRequest() {
        when(fileValidator.detectContentType(any())).thenReturn(null);

        assertThatThrownBy(() -> service.uploadImages(session, List.of(file("bad.png")), List.of(0)))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(ErrorCode.INVALID_REQUEST);
    }

    @Test
    void uploadImages_elventhImage_rejected() {
        session.getUploadedImageCount().set(10);

        assertThatThrownBy(() -> service.uploadImages(session, List.of(file("x.png")), List.of(10)))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(ErrorCode.INVALID_REQUEST);
        verify(aiClient, never()).extractFromImage(any(), anyInt(), any());
    }

    @Test
    void hasBlockingUnconfirmedCards_lowConfidenceWithValue_blocks() {
        session.upsertCard(new ExtractedEvent("evt_1", 0, "chat", "2026-09-01T00:00:00+09:00", "self", "요약", 1000L,
                null, null, new Identifiers(null, null),
                new FieldConfidence("low", "high", "high", null, null), null, ExtractedEvent.PENDING));

        assertThat(service.hasBlockingUnconfirmedCards(session)).isTrue();
    }

    @Test
    void hasBlockingUnconfirmedCards_lowConfidenceButAmountNull_doesNotBlock() {
        session.upsertCard(new ExtractedEvent("evt_1", 0, "chat", "2026-09-01T00:00:00+09:00", "self", "요약", null,
                null, null, new Identifiers(null, null),
                new FieldConfidence("high", "high", "low", null, null), null, ExtractedEvent.PENDING));

        assertThat(service.hasBlockingUnconfirmedCards(session)).isFalse();
    }

    /** AI-server가 계약(field_confidence 항상 존재)을 어겨도 NPE로 500이 나지 않고, 값이 있으면 보수적으로 차단한다. */
    @Test
    void hasBlockingUnconfirmedCards_nullFieldConfidenceWithValue_blocksInsteadOfThrowing() {
        session.upsertCard(new ExtractedEvent("evt_1", 0, "chat", "2026-09-01T00:00:00+09:00", "self", "요약", 1000L,
                null, null, new Identifiers(null, null),
                null, null, ExtractedEvent.PENDING));

        assertThat(service.hasBlockingUnconfirmedCards(session)).isTrue();
    }

    @Test
    void hasBlockingUnconfirmedCards_confirmedCardIgnoredEvenIfLow() {
        session.upsertCard(new ExtractedEvent("evt_1", 0, "chat", "2026-09-01T00:00:00+09:00", "self", "요약", 1000L,
                null, null, new Identifiers(null, null),
                new FieldConfidence("low", "high", "high", null, null), null, ExtractedEvent.USER_CONFIRMED));

        assertThat(service.hasBlockingUnconfirmedCards(session)).isFalse();
    }

    @Test
    void confirm_withCorrections_updatesFieldsAndMarksUserCorrected() {
        session.upsertCard(card("evt_1", 0, 1000L, ExtractedEvent.PENDING));

        ConfirmResponse response = service.confirm(session,
                new ConfirmRequest("evt_1", true, new Corrections(null, null, 700_000L, "김철수", null)));

        ExtractedEvent updated = session.findCard("evt_1").orElseThrow();
        assertThat(updated.amount()).isEqualTo(700_000L);
        assertThat(updated.counterpartyName()).isEqualTo("김철수");
        assertThat(updated.confirmationStatus()).isEqualTo(ExtractedEvent.USER_CORRECTED);
        assertThat(response.confirmedCount()).isEqualTo(1);
        assertThat(response.unconfirmedCount()).isEqualTo(0);
    }

    @Test
    void confirm_withoutCorrections_marksUserConfirmed() {
        session.upsertCard(card("evt_1", 0, 1000L, ExtractedEvent.PENDING));

        service.confirm(session, new ConfirmRequest("evt_1", true, null));

        assertThat(session.findCard("evt_1").orElseThrow().confirmationStatus()).isEqualTo(ExtractedEvent.USER_CONFIRMED);
    }

    @Test
    void confirm_falseDeletesCard() {
        session.upsertCard(card("evt_1", 0, 1000L, ExtractedEvent.PENDING));

        service.confirm(session, new ConfirmRequest("evt_1", false, null));

        assertThat(session.findCard("evt_1")).isEmpty();
    }
}
