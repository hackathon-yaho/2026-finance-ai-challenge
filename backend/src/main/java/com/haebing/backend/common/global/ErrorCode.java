package com.haebing.backend.common.global;

import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;

/**
 * docs/02-architecture/api-contract.md 오류 절에 정의된 6종.
 * code 문자열은 프론트와의 계약이므로 임의로 바꾸지 않는다.
 */
@Getter
@RequiredArgsConstructor
public enum ErrorCode {

    EXTRACTION_FAILED(HttpStatus.BAD_GATEWAY, "EXTRACTION_FAILED", "이미지에서 내용을 읽지 못했습니다."),
    TIMEOUT(HttpStatus.GATEWAY_TIMEOUT, "TIMEOUT", "처리 시간이 초과되었습니다."),
    SESSION_EXPIRED(HttpStatus.GONE, "SESSION_EXPIRED", "세션이 만료되었습니다."),
    UNCONFIRMED_FIELDS(HttpStatus.CONFLICT, "UNCONFIRMED_FIELDS", "확인이 필요한 카드가 남아 있습니다."),
    INVALID_FORM_FIELD(HttpStatus.BAD_REQUEST, "INVALID_FORM_FIELD", "입력값이 형식에 맞지 않습니다."),
    QUOTA_EXCEEDED(HttpStatus.TOO_MANY_REQUESTS, "QUOTA_EXCEEDED", "AI 서비스 사용량이 초과되었습니다."),
    DRAFT_FAILED(HttpStatus.BAD_GATEWAY, "DRAFT_FAILED", "소명서 생성에 실패했습니다."),
    // internal-api-contract.md 2026-08-26 신설 — AI-server 설정 오류(키 미설정·인증 실패). 사용자 입력과 무관해
    // 재시도·텍스트 입력 유도를 하지 않는다(AiClientImpl이 이 코드는 재시도조차 하지 않고 바로 던진다).
    AI_CONFIG_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "AI_CONFIG_ERROR", "일시적인 오류로 처리하지 못했습니다. 잠시 후 다시 시도해주세요."),

    // api-contract.md 오류표에는 없는 항목 — GlobalExceptionHandler의 예외되지 않은 오류를 위한 fallback.
    INVALID_REQUEST(HttpStatus.BAD_REQUEST, "INVALID_REQUEST", "필수 파라미터가 없거나 형식이 올바르지 않습니다."),
    INTERNAL_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_ERROR", "서버 내부 오류가 발생했습니다.");

    private final HttpStatus httpStatus;
    private final String code;
    private final String message;
}
