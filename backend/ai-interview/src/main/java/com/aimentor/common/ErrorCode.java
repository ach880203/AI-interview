package com.aimentor.common;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 전역 에러 코드 열거형
 * AGENTS.md에 정의된 에러 코드를 관리
 * GlobalExceptionHandler에서 참조하여 일관된 에러 응답 생성
 */
@Getter
@RequiredArgsConstructor
public enum ErrorCode {

    // 인증/인가 관련
    INVALID_TOKEN("INVALID_TOKEN", "유효하지 않은 토큰입니다."),
    EXPIRED_TOKEN("EXPIRED_TOKEN", "만료된 토큰입니다."),
    FORBIDDEN("FORBIDDEN", "접근 권한이 없습니다."),
    UNAUTHORIZED("UNAUTHORIZED", "인증이 필요합니다."),

    // 리소스 관련
    NOT_FOUND("NOT_FOUND", "리소스를 찾을 수 없습니다."),
    USER_NOT_FOUND("USER_NOT_FOUND", "사용자를 찾을 수 없습니다."),

    // 입력값 관련
    VALIDATION_ERROR("VALIDATION_ERROR", "입력값이 올바르지 않습니다."),
    DUPLICATE_EMAIL("DUPLICATE_EMAIL", "이미 사용 중인 이메일입니다."),

    // 도서/주문 관련
    OUT_OF_STOCK("OUT_OF_STOCK", "재고가 부족합니다."),
    PAYMENT_VERIFICATION_FAILED("PAYMENT_VERIFICATION_FAILED", "결제 검증에 실패했습니다."),
    PAYMENT_AMOUNT_MISMATCH("PAYMENT_AMOUNT_MISMATCH", "결제 금액이 주문 금액과 다릅니다."),

    // 외부 서버 관련
    AI_SERVER_ERROR("AI_SERVER_ERROR", "AI 서버 오류가 발생했습니다."),
    SPEECH_SERVER_ERROR("SPEECH_SERVER_ERROR", "음성 처리 서버 오류가 발생했습니다."),

    // 사용 제한 관련
    DAILY_USAGE_LIMIT_EXCEEDED("DAILY_USAGE_LIMIT_EXCEEDED", "오늘의 무료 이용 횟수를 모두 사용했습니다. 구독 후 무제한으로 이용해보세요."),

    // 일반 서버 오류
    INTERNAL_SERVER_ERROR("INTERNAL_SERVER_ERROR", "서버 내부 오류가 발생했습니다.");

    private final String code;
    private final String message;
}
