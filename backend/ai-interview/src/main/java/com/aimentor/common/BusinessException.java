package com.aimentor.common;

import lombok.Getter;

/**
 * 비즈니스 로직 예외 기반 클래스
 * 서비스 레이어에서 발생하는 도메인 예외를 표현
 * GlobalExceptionHandler에서 포착하여 ApiResponse.error()로 변환
 */
@Getter
public class BusinessException extends RuntimeException {

    private final ErrorCode errorCode;

    public BusinessException(ErrorCode errorCode) {
        super(errorCode.getMessage());
        this.errorCode = errorCode;
    }

    public BusinessException(ErrorCode errorCode, String detail) {
        super(detail);
        this.errorCode = errorCode;
    }
}
