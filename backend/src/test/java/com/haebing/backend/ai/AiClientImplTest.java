package com.haebing.backend.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.haebing.backend.ai.demo.DemoFixtures;
import com.haebing.backend.ai.dto.ExtractResult;
import com.haebing.backend.common.global.ErrorCode;
import com.haebing.backend.common.global.exception.BusinessException;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

class AiClientImplTest {

    private static final String CARD_JSON = """
            {
              "cards": [{
                "event_id": "evt_2_1",
                "source_image_index": 2,
                "source_type": "chat",
                "occurred_at": "2026-09-02T14:12:00+09:00",
                "actor": "self",
                "summary": "물품대금 700,000원 입금",
                "amount": 700000,
                "counterparty_name": "김철수",
                "payer_name": null,
                "identifiers": { "tracking_no": null, "account_last4": null },
                "field_confidence": { "occurred_at": "high", "actor": "high", "amount": "high", "counterparty_name": "high", "payer_name": null },
                "source_region": { "x": 0.1, "y": 0.2, "w": 0.3, "h": 0.4 },
                "confirmation_status": "pending"
              }],
              "signals": { "threat_detected": false, "delivery_evidence": true, "life_activity": false, "quality_flags": { "blurry": false, "missing_date": false, "amount_mismatch": false } },
              "qualityFlags": { "evt_2_1": { "blurry": false, "missing_date": false, "amount_mismatch": false } }
            }
            """;

    private static final String ERROR_JSON = """
            { "error": "EXTRACTION_FAILED", "message": "이미지에서 내용을 읽지 못했습니다.", "fallback": "text_input" }
            """;

    private RestClient.Builder builder = RestClient.builder();
    private MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
    private RestClient sharedClient = builder.build();
    private DemoFixtures demoFixtures = new DemoFixtures(new ObjectMapper());
    private AiClientImpl client = new AiClientImpl(sharedClient, sharedClient, "test-token", demoFixtures, false);

    @Test
    void extractFromImage_success_parsesCardsSignalsQualityFlags() {
        server.expect(requestTo("/internal/extract?image_index=2&reference_date=2026-08-27&intake_when=2026-08-15"))
                .andExpect(method(org.springframework.http.HttpMethod.POST))
                .andExpect(header("X-Internal-Token", "test-token"))
                .andExpect(header("Content-Type", "image/png"))
                .andRespond(withSuccess(CARD_JSON, MediaType.APPLICATION_JSON));

        ExtractResult result = client.extractFromImage(new byte[]{1, 2, 3}, 2, "image/png", "2026-08-27", "2026-08-15");

        assertThat(result.cards()).hasSize(1);
        assertThat(result.cards().get(0).eventId()).isEqualTo("evt_2_1");
        assertThat(result.cards().get(0).counterpartyName()).isEqualTo("김철수");
        assertThat(result.signals().deliveryEvidence()).isTrue();
        assertThat(result.qualityFlags()).containsKey("evt_2_1");
        server.verify();
    }

    @Test
    void extract_502TwiceInARow_throwsBusinessExceptionWithFallback() {
        server.expect(requestTo("/internal/extract?image_index=0&reference_date=2026-08-27"))
                .andRespond(withStatus(org.springframework.http.HttpStatus.BAD_GATEWAY)
                        .contentType(MediaType.APPLICATION_JSON).body(ERROR_JSON));
        server.expect(requestTo("/internal/extract?image_index=0&reference_date=2026-08-27"))
                .andRespond(withStatus(org.springframework.http.HttpStatus.BAD_GATEWAY)
                        .contentType(MediaType.APPLICATION_JSON).body(ERROR_JSON));

        assertThatThrownBy(() -> client.extractFromImage(new byte[]{1}, 0, "image/png", "2026-08-27", null))
                .isInstanceOf(BusinessException.class)
                .satisfies(e -> {
                    BusinessException be = (BusinessException) e;
                    assertThat(be.getErrorCode()).isEqualTo(ErrorCode.EXTRACTION_FAILED);
                    assertThat(be.getFallback()).isEqualTo("/api/evidence/text");
                });
        server.verify();
    }

    @Test
    void extract_502ThenSuccess_retrySucceeds() {
        server.expect(requestTo("/internal/extract?image_index=0&reference_date=2026-08-27"))
                .andRespond(withStatus(org.springframework.http.HttpStatus.BAD_GATEWAY)
                        .contentType(MediaType.APPLICATION_JSON).body(ERROR_JSON));
        server.expect(requestTo("/internal/extract?image_index=0&reference_date=2026-08-27"))
                .andRespond(withSuccess(CARD_JSON, MediaType.APPLICATION_JSON));

        ExtractResult result = client.extractFromImage(new byte[]{1}, 0, "image/png", "2026-08-27", null);

        assertThat(result.cards()).hasSize(1);
        server.verify();
    }

    @Test
    void extract_429_fallsBackToDemoFixtureWithoutRetry() {
        server.expect(requestTo("/internal/extract?image_index=0&reference_date=2026-08-27"))
                .andRespond(withStatus(org.springframework.http.HttpStatus.TOO_MANY_REQUESTS)
                        .contentType(MediaType.APPLICATION_JSON).body("{\"error\":\"QUOTA_EXCEEDED\"}"));

        // F4-05 — 재시도하지 않고, 예외 대신 데모 응답으로 폴백한다.
        ExtractResult result = client.extractFromImage(new byte[]{1}, 0, "image/png", "2026-08-27", null);

        assertThat(result.cards().get(0).eventId()).isEqualTo("evt_0_1");
        server.verify(); // 딱 1번만 호출됐어야 한다 (재시도 없음)
    }

    @Test
    void extract_500_mapsToAiConfigErrorWithoutRetry() {
        // internal-api-contract.md 2026-08-26 — AI-server 설정 오류(LLM 키 미설정 등). 재시도하지 않는다.
        server.expect(requestTo("/internal/extract?image_index=0&reference_date=2026-08-27"))
                .andRespond(withStatus(org.springframework.http.HttpStatus.INTERNAL_SERVER_ERROR)
                        .contentType(MediaType.APPLICATION_JSON).body("{\"error\":\"AI_CONFIG_ERROR\"}"));

        assertThatThrownBy(() -> client.extractFromImage(new byte[]{1}, 0, "image/png", "2026-08-27", null))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(ErrorCode.AI_CONFIG_ERROR);
        server.verify(); // 딱 1번만 호출됐어야 한다 (재시도 없음)
    }

    @Test
    void extractFromText_502_hasNoFallbackAndPathSpecificMessage() {
        // 텍스트로 이미 보낸 요청에 "텍스트로 입력하세요"를 다시 안내하면 같은 자리를 맴돈다.
        server.expect(requestTo("/internal/extract?reference_date=2026-08-27")).andRespond(withStatus(org.springframework.http.HttpStatus.BAD_GATEWAY));
        server.expect(requestTo("/internal/extract?reference_date=2026-08-27")).andRespond(withStatus(org.springframework.http.HttpStatus.BAD_GATEWAY));

        assertThatThrownBy(() -> client.extractFromText("텍스트 입력", "2026-08-27", null))
                .isInstanceOf(BusinessException.class)
                .satisfies(e -> {
                    BusinessException be = (BusinessException) e;
                    assertThat(be.getErrorCode()).isEqualTo(ErrorCode.EXTRACTION_FAILED);
                    assertThat(be.getFallback()).isNull();
                    assertThat(be.getMessage()).doesNotContain("이미지");
                });
        server.verify();
    }

    @Test
    void aiServerUrlUnconfigured_mapsTo502NotRaw400WithoutLeakingInternalMessage() {
        // AI_SERVER_URL이 빈 값이면 RestClient가 상대 경로만으로 요청을 실행하려다
        // IllegalArgumentException("URI with undefined scheme")을 던진다 (local-integration-findings.md §5).
        RestClient unconfigured = RestClient.create();
        AiClientImpl badClient = new AiClientImpl(unconfigured, unconfigured, "test-token", demoFixtures, false);

        assertThatThrownBy(() -> badClient.extractFromImage(new byte[]{1}, 0, "image/png", "2026-08-27", null))
                .isInstanceOf(BusinessException.class)
                .satisfies(e -> {
                    BusinessException be = (BusinessException) e;
                    assertThat(be.getErrorCode()).isEqualTo(ErrorCode.EXTRACTION_FAILED);
                    assertThat(be.getMessage()).doesNotContain("URI").doesNotContain("scheme");
                });
    }

    @Test
    void demoMode_true_returnsFixtureWithoutCallingNetwork() {
        AiClientImpl demoClient = new AiClientImpl(sharedClient, sharedClient, "test-token", demoFixtures, true);

        ExtractResult result = demoClient.extractFromImage(new byte[]{1}, 0, "image/png", "2026-08-27", null);

        assertThat(result.cards().get(0).eventId()).isEqualTo("evt_0_1");
        server.verify(); // 등록된 기대 요청이 없으므로, 실제로 호출됐다면 이 시점 전에 이미 실패했을 것이다
    }

    @Test
    void extractFromText_sendsJsonContentType() {
        server.expect(requestTo("/internal/extract?reference_date=2026-08-27"))
                .andExpect(header("Content-Type", "application/json"))
                .andExpect(jsonPath("$.rawText").value("9월 2일에 45만원 입금받음"))
                .andRespond(withSuccess(CARD_JSON, MediaType.APPLICATION_JSON));

        ExtractResult result = client.extractFromText("9월 2일에 45만원 입금받음", "2026-08-27", null);

        assertThat(result.cards()).hasSize(1);
        server.verify();
    }

    @Test
    void draft_success_parsesDraftTextAndSentences() {
        String draftJson = """
                { "draftText": "본문", "sentences": [{ "sentenceId": "s1", "text": "문장1", "evidenceRefs": [] }], "checklist": [], "factCheckPassed": true }
                """;
        server.expect(requestTo("/internal/draft"))
                .andExpect(header("Content-Type", "application/json"))
                .andExpect(header("X-Internal-Token", "test-token"))
                .andRespond(withSuccess(draftJson, MediaType.APPLICATION_JSON));

        var result = client.draft(new com.haebing.backend.ai.dto.DraftRequest(
                java.util.List.of(), "goods", "SUBMISSION_READY", null));

        assertThat(result.draftText()).isEqualTo("본문");
        assertThat(result.sentences()).hasSize(1);
        assertThat(result.factCheckPassed()).isTrue();
        server.verify();
    }

    @Test
    void draft_502TwiceInARow_throwsDraftFailedWithNoFallback() {
        server.expect(requestTo("/internal/draft"))
                .andRespond(withStatus(org.springframework.http.HttpStatus.BAD_GATEWAY));
        server.expect(requestTo("/internal/draft"))
                .andRespond(withStatus(org.springframework.http.HttpStatus.BAD_GATEWAY));

        assertThatThrownBy(() -> client.draft(new com.haebing.backend.ai.dto.DraftRequest(
                java.util.List.of(), "goods", "SUBMISSION_READY", null)))
                .isInstanceOf(BusinessException.class)
                .satisfies(e -> {
                    BusinessException be = (BusinessException) e;
                    assertThat(be.getErrorCode()).isEqualTo(ErrorCode.DRAFT_FAILED);
                    assertThat(be.getFallback()).isNull();
                });
        server.verify();
    }
}
