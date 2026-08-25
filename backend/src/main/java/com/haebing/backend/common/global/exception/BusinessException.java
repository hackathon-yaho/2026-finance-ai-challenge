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

    public BusinessException(ErrorCode errorCode, String detail, String fallback) {
        super(detail != null ? errorCode.getMessage() + " | " + detail : errorCode.getMessage());
        this.errorCode = errorCode;
        this.fallback = fallback;
    }
}
