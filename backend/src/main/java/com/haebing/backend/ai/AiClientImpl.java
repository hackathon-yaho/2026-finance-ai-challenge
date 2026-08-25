package com.haebing.backend.ai;

import com.haebing.backend.ai.demo.DemoFixtures;
import com.haebing.backend.ai.dto.DraftRequest;
import com.haebing.backend.ai.dto.DraftResult;
import com.haebing.backend.ai.dto.ExtractResult;
import com.haebing.backend.ai.exception.AiRetryableException;
import com.haebing.backend.common.global.ErrorCode;
import com.haebing.backend.common.global.exception.BusinessException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;

import java.util.function.Supplier;

/**
 * docs/backend/phase-3-evidence-timeline.md 3-1.
 * 이미지 1장당 1요청, raw body 전달(A 계열, 멀티파트 미사용). 실패 시 동일 요청 1회 재시도.
 */
@Slf4j
@Component
public class AiClientImpl implements AiClient {

    // AI-server가 내부적으로 주는 fallback은 "text_input"이지만, 공개 응답에는 내부 경로를 노출하지 않는다.
    // 텍스트 경로 실패에는 이 fallback을 붙이지 않는다 — 이미 텍스트로 보낸 요청에 텍스트 입력을 대안으로
    // 주면 같은 자리를 맴돈다 (internal-api-contract.md 2026-08-26 명확화).
    private static final String FALLBACK_TEXT_INPUT = "/api/evidence/text";
    private static final String TEXT_EXTRACTION_FAILED_MESSAGE = "입력하신 내용에서 사실을 확인하지 못했습니다.";

    private final RestClient extractRestClient;
    private final RestClient draftRestClient;
    private final String internalToken;
    private final DemoFixtures demoFixtures;
    private final boolean demoMode;

    public AiClientImpl(RestClient extractRestClient, RestClient draftRestClient,
                         @Value("${app.internal-token}") String internalToken,
                         DemoFixtures demoFixtures,
                         @Value("${app.demo-mode}") boolean demoMode) {
        this.extractRestClient = extractRestClient;
        this.draftRestClient = draftRestClient;
        this.internalToken = internalToken;
        this.demoFixtures = demoFixtures;
        this.demoMode = demoMode;
    }

    @Override
    public ExtractResult extractFromImage(byte[] imageBytes, int imageIndex, String contentType) {
        if (demoMode) return demoFixtures.extractForImage(imageIndex);
        try {
            return withRetry(() -> extractRestClient.post()
                    .uri(uriBuilder -> uriBuilder.path("/internal/extract").queryParam("image_index", imageIndex).build())
                    .contentType(MediaType.parseMediaType(contentType))
                    .header("X-Internal-Token", internalToken)
                    .body(imageBytes)
                    .retrieve()
                    .body(ExtractResult.class), ErrorCode.EXTRACTION_FAILED, FALLBACK_TEXT_INPUT);
        } catch (BusinessException e) {
            if (e.getErrorCode() != ErrorCode.QUOTA_EXCEEDED) throw e;
            log.warn("[AiClient] QUOTA_EXCEEDED — 데모 응답으로 폴백 (F4-05)");
            return demoFixtures.extractForImage(imageIndex);
        }
    }

    @Override
    public ExtractResult extractFromText(String rawText) {
        if (demoMode) return demoFixtures.extractForText();
        try {
            return withRetry(() -> extractRestClient.post()
                    .uri("/internal/extract")
                    .contentType(MediaType.APPLICATION_JSON)
                    .header("X-Internal-Token", internalToken)
                    .body(new TextExtractRequest(rawText))
                    .retrieve()
                    .body(ExtractResult.class), ErrorCode.EXTRACTION_FAILED, null, TEXT_EXTRACTION_FAILED_MESSAGE);
        } catch (BusinessException e) {
            if (e.getErrorCode() != ErrorCode.QUOTA_EXCEEDED) throw e;
            log.warn("[AiClient] QUOTA_EXCEEDED — 데모 응답으로 폴백 (F4-05)");
            return demoFixtures.extractForText();
        }
    }

    @Override
    public DraftResult draft(DraftRequest request) {
        if (demoMode) return demoFixtures.draft();
        try {
            return withRetry(() -> draftRestClient.post()
                    .uri("/internal/draft")
                    .contentType(MediaType.APPLICATION_JSON)
                    .header("X-Internal-Token", internalToken)
                    .body(request)
                    .retrieve()
                    .body(DraftResult.class), ErrorCode.DRAFT_FAILED, null);
        } catch (BusinessException e) {
            if (e.getErrorCode() != ErrorCode.QUOTA_EXCEEDED) throw e;
            log.warn("[AiClient] QUOTA_EXCEEDED — 데모 응답으로 폴백 (F4-05)");
            return demoFixtures.draft();
        }
    }

    private <T> T withRetry(Supplier<T> call, ErrorCode primaryFailureCode, String fallback) {
        return withRetry(call, primaryFailureCode, fallback, null);
    }

    /** messageOverride가 있으면 primaryFailureCode의 기본 메시지 대신 경로별 메시지를 쓴다(예: 텍스트 입력 실패). */
    private <T> T withRetry(Supplier<T> call, ErrorCode primaryFailureCode, String fallback, String messageOverride) {
        try {
            return callOnce(call, primaryFailureCode, fallback);
        } catch (AiRetryableException first) {
            log.warn("[AiClient] {} — 1회 재시도", first.getMessage());
            try {
                return callOnce(call, primaryFailureCode, fallback);
            } catch (AiRetryableException second) {
                throw new BusinessException(second.getErrorCode(), messageOverride, second.getFallback());
            }
        }
    }

    private <T> T callOnce(Supplier<T> call, ErrorCode primaryFailureCode, String fallback) {
        try {
            return call.get();
        } catch (HttpClientErrorException.TooManyRequests e) {
            // QUOTA_EXCEEDED(429) — 재시도하지 않는다. 백엔드는 데모 모드로 폴백한다(Phase 6).
            throw new BusinessException(ErrorCode.QUOTA_EXCEEDED);
        } catch (HttpClientErrorException.Unauthorized e) {
            // INTERNAL_TOKEN 불일치 — 설정 오류. 내부 사정을 프론트에 노출하지 않는다.
            log.error("[AiClient] INTERNAL_TOKEN 불일치 — AI-server가 401을 반환했습니다");
            throw new BusinessException(ErrorCode.INTERNAL_ERROR);
        } catch (HttpServerErrorException.InternalServerError e) {
            // AI_CONFIG_ERROR(500, 2026-08-26 신설) — AI-server의 LLM 키 미설정·인증 실패. 사용자 입력과
            // 무관해 재시도하지 않는다(AI-server도 이 오류엔 재시도하지 않기로 함). AI 담당에게 알려야 하는
            // 상황이라 error 레벨로 남긴다 (internal-api-contract.md "AI_CONFIG_ERROR").
            log.error("[AiClient] AI_CONFIG_ERROR — AI-server 설정 오류로 추정. AI 담당 확인 필요");
            throw new BusinessException(ErrorCode.AI_CONFIG_ERROR);
        } catch (HttpServerErrorException.BadGateway e) {
            // EXTRACTION_FAILED 또는 DRAFT_FAILED(둘 다 502) — 재시도 대상.
            throw new AiRetryableException(primaryFailureCode, fallback, e);
        } catch (HttpServerErrorException.GatewayTimeout e) {
            // AI-server 내부 타임아웃(504) — 재시도 대상.
            throw new AiRetryableException(ErrorCode.TIMEOUT, fallback, e);
        } catch (ResourceAccessException e) {
            // 우리 쪽 커넥션/읽기 타임아웃 — 재시도 대상.
            throw new AiRetryableException(ErrorCode.TIMEOUT, fallback, e);
        } catch (IllegalArgumentException e) {
            // AI_SERVER_URL 미설정/오설정 — RestClient가 URI를 만들다 던진다. 연결 실패와 같은 층위라
            // 계약상 4xx가 아니라 502/504 계열(primaryFailureCode)로 묶는다. 내부 예외 메시지는 노출하지 않는다
            // (docs/request/backend/local-integration-findings.md §5).
            log.error("[AiClient] AI-server 연결 실패(설정 오류로 추정): {}", e.getMessage());
            throw new AiRetryableException(primaryFailureCode, fallback, e);
        }
    }

    private record TextExtractRequest(String rawText) {
    }
}
