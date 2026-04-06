package com.aimentor.common.exception;

/**
 * AI / Speech 외부 서버 호출 실패 예외
 *
 * 발생 시점:
 * - Python AI 서버(http://localhost:8000)가 응답 없음 / 5xx 반환
 * - Whisper STT 서버 장애
 *
 * 처리: GlobalExceptionHandler → 503 Service Unavailable + AI_SERVER_ERROR / SPEECH_SERVER_ERROR
 *
 * 사용 예시:
 *   throw new AiServiceException("AI 서버 응답 없음", cause);
 *   throw new AiServiceException(ErrorType.SPEECH, "STT 변환 실패", cause);
 */
public class AiServiceException extends RuntimeException {

    /** 에러 타입 (AI 서버 vs STT 서버 구분용) */
    public enum ErrorType { AI, SPEECH }

    private final ErrorType errorType;

    public AiServiceException(String message) {
        super(message);
        this.errorType = ErrorType.AI;
    }

    public AiServiceException(String message, Throwable cause) {
        super(message, cause);
        this.errorType = ErrorType.AI;
    }

    public AiServiceException(ErrorType errorType, String message, Throwable cause) {
        super(message, cause);
        this.errorType = errorType;
    }

    public ErrorType getErrorType() {
        return errorType;
    }
}
