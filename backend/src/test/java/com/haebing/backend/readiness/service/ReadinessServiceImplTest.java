package com.haebing.backend.readiness.service;

import com.haebing.backend.ai.AiClient;
import com.haebing.backend.evidence.service.EvidenceServiceImpl;
import com.haebing.backend.evidence.validation.FileValidator;
import com.haebing.backend.readiness.dto.ChecklistItem;
import com.haebing.backend.readiness.dto.ReadinessResponse;
import com.haebing.backend.readiness.dto.SelfHeldRequest;
import com.haebing.backend.session.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

/** docs/backend/phase-4-readiness.md "완료 기준 · 단위 테스트 (TC-01~06)" + TC-21~23. */
class ReadinessServiceImplTest {

    private final ChecklistEvaluator evaluator = new ChecklistEvaluator();
    private final EvidenceServiceImpl evidenceService =
            new EvidenceServiceImpl(mock(FileValidator.class), mock(AiClient.class));
    private final ReadinessServiceImpl service = new ReadinessServiceImpl(evaluator, evidenceService);

    private Session session;

    @BeforeEach
    void setUp() {
        session = new Session("s1s1s1s1s1s1s1s1", Instant.now().plusSeconds(1800));
    }

    private ExtractedEvent confirmedCard(String id, String sourceType, Long amount, String counterparty, String payer) {
        return new ExtractedEvent(id, 0, sourceType, "2026-09-01T10:00:00+09:00", "self", "요약", amount,
                counterparty, payer, new Identifiers(null, null),
                new FieldConfidence("high", "high", "high", counterparty != null ? "high" : null, payer != null ? "high" : null),
                null, ExtractedEvent.USER_CONFIRMED);
    }

    @Test
    void tc01_goodsFullyConfirmed_submissionReady() {
        session.getIntake().put("kind", "goods");
        session.getIntake().put("deliveryMethod", "courier");
        session.upsertCard(confirmedCard("evt_1", "chat", 700_000L, "김철수", "김철수"));
        session.upsertCard(confirmedCard("evt_2", "bank", 700_000L, null, null));
        session.upsertCard(confirmedCard("evt_3", "shipping", null, null, null));

        ReadinessResponse response = service.evaluate(session);

        assertThat(response.readiness()).isEqualTo(ReadinessResponse.SUBMISSION_READY);
        assertThat(response.notices()).contains(NoticeTexts.FINAL_DECISION_BY_BANK, NoticeTexts.PROCESSING_PERIOD);
    }

    @Test
    void tc02_serviceMissingEmploymentProof_supplementNeeded_thenSelfHeldResolves() {
        session.getIntake().put("kind", "service");
        session.upsertCard(confirmedCard("evt_1", "bank", 500_000L, null, null));

        assertThat(service.evaluate(session).readiness()).isEqualTo(ReadinessResponse.SUPPLEMENT_NEEDED);

        // 건강보험 자격득실 확인서 중 하나만 있어도 충족 (택일)
        service.selfHeld(session, new SelfHeldRequest("service.employment.insurance", true));

        assertThat(service.evaluate(session).readiness()).isEqualTo(ReadinessResponse.SUBMISSION_READY);
    }

    @Test
    void tc03_confirmedEvidenceWithThreat_submissionReadyAndUrgentAlert() {
        session.getIntake().put("kind", "goods");
        session.getIntake().put("deliveryMethod", "courier");
        session.upsertCard(confirmedCard("evt_1", "chat", 700_000L, null, null));
        session.upsertCard(confirmedCard("evt_2", "bank", 700_000L, null, null));
        session.upsertCard(confirmedCard("evt_3", "shipping", null, null, null));
        session.setSignals(new Signals(true, true, false, session.getSignals().qualityFlags()));

        ReadinessResponse response = service.evaluate(session);

        assertThat(response.readiness()).isEqualTo(ReadinessResponse.SUBMISSION_READY);
        assertThat(response.urgentAlert()).isTrue();
    }

    @Test
    void tc04_pastHistory_bankCheckRequired_noBannedPhrases() {
        session.getIntake().put("kind", "goods");
        session.getIntake().put("history", "true");
        session.upsertCard(confirmedCard("evt_1", "chat", 1000L, null, null));

        ReadinessResponse response = service.evaluate(session);

        assertThat(response.readiness()).isEqualTo(ReadinessResponse.BANK_CHECK_REQUIRED);
        assertThat(response.notices()).contains(NoticeTexts.HISTORY_NOTICE, NoticeTexts.FINAL_DECISION_BY_BANK, NoticeTexts.PROCESSING_PERIOD);
        assertNoBannedPhrases(response);
    }

    /**
     * TC-05 — 금액 신뢰도 낮음 / 사유 불명 → 확인 질문 유도, 미확인 상태로 소명서 생성 안 됨.
     * "미확인 상태로 소명서 생성 안 됨" 절반은 DraftController·ReadinessController가 공유하는
     * {@code EvidenceServiceImpl.hasBlockingUnconfirmedCards}가 담당하며, 그쪽은
     * {@code EvidenceServiceImplTest.hasBlockingUnconfirmedCards_lowConfidenceWithValue_blocks}에서
     * 이미 검증한다. 여기서는 "확인 질문 유도"(준비도 응답에 미확인 신호가 실리는지)만 검증한다.
     */
    @Test
    void tc05_lowAmountConfidenceAndUnclearReason_supplementNeededWithUnconfirmedNotice() {
        // kind를 안 넣으면 reasonOf()가 "unclear"로 떨어진다 (사유 불명).
        session.upsertCard(new ExtractedEvent("evt_1", 0, "bank", "2026-09-01T10:00:00+09:00", "self", "요약",
                1000L, null, null, new Identifiers(null, null),
                new FieldConfidence("high", "high", "low", null, null), null, ExtractedEvent.PENDING));

        ReadinessResponse response = service.evaluate(session);

        assertThat(response.reason()).isEqualTo("unclear");
        assertThat(response.readiness()).isEqualTo(ReadinessResponse.SUPPLEMENT_NEEDED);
        assertThat(response.notices()).contains(NoticeTexts.unconfirmedFieldsExplanation());
    }

    @Test
    void tc06_zeroEvidence_supplementNeeded() {
        session.getIntake().put("kind", "goods");

        ReadinessResponse response = service.evaluate(session);

        assertThat(response.readiness()).isEqualTo(ReadinessResponse.SUPPLEMENT_NEEDED);
        assertThat(findItem(response.checklist(), "legal.proof").status()).isEqualTo(ChecklistItem.STATUS_UNMET);
    }

    @Test
    void tc21_goodsNoBusinessRegistration_doesNotBlock() {
        session.getIntake().put("kind", "goods");
        session.getIntake().put("deliveryMethod", "courier");
        session.upsertCard(confirmedCard("evt_1", "chat", 700_000L, null, null));
        session.upsertCard(confirmedCard("evt_2", "bank", 700_000L, null, null));
        session.upsertCard(confirmedCard("evt_3", "shipping", null, null, null));
        // 사업자등록증 자가진술 안 함 — silent라 준비도에 영향 없어야 한다

        ReadinessResponse response = service.evaluate(session);

        assertThat(findItem(response.checklist(), "goods.business_reg").status()).isEqualTo(ChecklistItem.STATUS_UNMET);
        assertThat(response.readiness()).isEqualTo(ReadinessResponse.SUBMISSION_READY);
    }

    @Test
    void tc22_debtNoLoanRecord_doesNotBlock() {
        session.getIntake().put("kind", "debt");
        session.upsertCard(confirmedCard("evt_1", "chat", 500_000L, null, null));
        session.upsertCard(confirmedCard("evt_2", "bank", 500_000L, null, null));

        ReadinessResponse response = service.evaluate(session);

        assertThat(findItem(response.checklist(), "debt.loan_record").status()).isEqualTo(ChecklistItem.STATUS_UNMET);
        assertThat(response.readiness()).isEqualTo(ReadinessResponse.SUBMISSION_READY);
    }

    @Test
    void tc23_goodsTradeDocStatementOnly_groupMet() {
        session.getIntake().put("kind", "goods");
        service.selfHeld(session, new SelfHeldRequest("goods.trade_doc.statement", true));

        ReadinessResponse response = service.evaluate(session);

        assertThat(findItem(response.checklist(), "goods.trade_doc").status()).isEqualTo(ChecklistItem.STATUS_MET);
    }

    @Test
    void payerMatch_bothNamesMatch_met() {
        session.getIntake().put("kind", "goods");
        session.upsertCard(confirmedCard("evt_1", "chat", null, "김철수", null));
        session.upsertCard(confirmedCard("evt_2", "bank", null, null, "김철수"));

        ReadinessResponse response = service.evaluate(session);

        ChecklistItem payerMatch = findItem(response.checklist(), "payer_match");
        assertThat(payerMatch.status()).isEqualTo(ChecklistItem.STATUS_MET);
    }

    @Test
    void payerMatch_mismatch_needsExplanation_notBlocking() {
        session.getIntake().put("kind", "goods");
        session.upsertCard(confirmedCard("evt_1", "chat", null, "김철수", null));
        session.upsertCard(confirmedCard("evt_2", "bank", null, null, "박영희"));

        ReadinessResponse response = service.evaluate(session);

        assertThat(findItem(response.checklist(), "payer_match").status()).isEqualTo(ChecklistItem.STATUS_NEEDS_EXPLANATION);
        // 불일치는 네 신호 어디에도 안 들어간다 — 다른 요건이 갖춰지면 여전히 SUBMISSION_READY일 수 있다
        assertThat(response.readiness()).isNotEqualTo(ReadinessResponse.BANK_CHECK_REQUIRED);
    }

    @Test
    void payerMatch_oneNameNull_unknown() {
        session.getIntake().put("kind", "goods");
        session.upsertCard(confirmedCard("evt_1", "chat", null, "김철수", null));
        session.upsertCard(confirmedCard("evt_2", "bank", null, null, null));

        ReadinessResponse response = service.evaluate(session);

        assertThat(findItem(response.checklist(), "payer_match").status()).isEqualTo(ChecklistItem.STATUS_UNKNOWN);
    }

    @Test
    void catalog_payerMatchOnlyInGoods_notInOtherReasons() {
        assertThat(ChecklistCatalog.forReason("goods")).anyMatch(e -> e.id().equals("payer_match"));
        assertThat(ChecklistCatalog.forReason("service")).noneMatch(e -> e.id().equals("payer_match"));
        assertThat(ChecklistCatalog.forReason("debt")).noneMatch(e -> e.id().equals("payer_match"));
        assertThat(ChecklistCatalog.forReason("unclear")).noneMatch(e -> e.id().equals("payer_match"));
    }

    @Test
    void selfHeld_unknownItemId_rejected() {
        session.getIntake().put("kind", "goods");
        org.junit.jupiter.api.Assertions.assertThrows(
                com.haebing.backend.common.global.exception.BusinessException.class,
                () -> service.selfHeld(session, new SelfHeldRequest("no.such.item", true)));
    }

    private void assertNoBannedPhrases(ReadinessResponse response) {
        String all = String.join(" ", response.notices()) + " " +
                response.checklist().stream().map(c -> c.note() == null ? "" : c.note()).reduce("", String::concat);
        for (String banned : NoticeTexts.BANNED_PHRASES) {
            assertThat(all).doesNotContain(banned);
        }
    }

    private ChecklistItem findItem(List<ChecklistItem> checklist, String id) {
        return checklist.stream().filter(i -> i.id().equals(id)).findFirst()
                .orElseThrow(() -> new AssertionError("no item: " + id));
    }
}
