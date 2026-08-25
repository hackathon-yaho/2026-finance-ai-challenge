package com.haebing.backend.common.global.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.haebing.backend.common.global.ErrorCode;
import lombok.Builder;
import lombok.Getter;

/**
 * docs/02-architecture/api-contract.md 오류 응답 형태 { error, message, fallback }.
 * fallback은 EXTRACTION_FAILED 등 대체 경로가 있는 오류에서만 채워지며, 없으면 응답에서 생략된다.
 */
@Getter
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ErrorResponse {

    private final String error;
    private final String message;
    private final String fallback;

    public static ErrorResponse of(ErrorCode errorCode) {
        return ErrorResponse.builder()
                .error(errorCode.getCode())
                .message(errorCode.getMessage())
                .build();
    }

    public static ErrorResponse of(ErrorCode errorCode, String detail) {
        return ErrorResponse.builder()
                .error(errorCode.getCode())
                .message(errorCode.getMessage() + " | " + detail)
                .build();
    }

    /** message는 이미 완성된 문구를 그대로 받는다 (BusinessException.getMessage()에서 그대로 옮길 때 사용). */
    public static ErrorResponse of(ErrorCode errorCode, String message, String fallback) {
        return ErrorResponse.builder()
                .error(errorCode.getCode())
                .message(message)
                .fallback(fallback)
                .build();
    }
}
