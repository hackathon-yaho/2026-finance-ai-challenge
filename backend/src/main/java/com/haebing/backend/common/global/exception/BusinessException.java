package com.haebing.backend.common.global.exception;

import com.haebing.backend.common.global.ErrorCode;
import lombok.Getter;

@Getter
public class BusinessException extends RuntimeException {

    private final ErrorCode errorCode;
    private final String fallback;

    public BusinessException(ErrorCode errorCode) {
        super(errorCode.getMessage());
        this.errorCode = errorCode;
        this.fallback = null;
    }

    public BusinessException(ErrorCode errorCode, String detail) {
        super(errorCode.getMessage() + " | " + detail);
        this.errorCode = errorCode;
        this.fallback = null;
    }

    /** message가 null이 아니면 errorCode의 기본 메시지 대신 그대로 쓴다(접두 없음) — AiClientImpl의 경로별 메시지용. */
    public BusinessException(ErrorCode errorCode, String message, String fallback) {
        super(message != null ? message : errorCode.getMessage());
        this.errorCode = errorCode;
        this.fallback = fallback;
    }
}
