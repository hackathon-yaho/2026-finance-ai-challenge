package com.haebing.backend.ai.exception;

import com.haebing.backend.common.global.ErrorCode;
import lombok.Getter;

/** AiClientImpl 내부에서만 쓴다 — 1회 재시도 후에도 실패하면 BusinessException으로 바뀐다. */
@Getter
public class AiRetryableException extends RuntimeException {

    private final ErrorCode errorCode;
    private final String fallback;

    public AiRetryableException(ErrorCode errorCode, String fallback, Throwable cause) {
        super(errorCode.getMessage(), cause);
        this.errorCode = errorCode;
        this.fallback = fallback;
    }
}
