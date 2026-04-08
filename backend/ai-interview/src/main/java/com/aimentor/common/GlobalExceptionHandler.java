package com.aimentor.common;

import com.aimentor.common.exception.AiServiceException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.stream.Collectors;

/**
 * 전역 예외 처리 핸들러
 * @RestControllerAdvice: 모든 @RestController에서 발생하는 예외를 중앙 처리
 * 모든 예외를 ApiResponse.error() 형식으로 변환하여 일관된 응답 보장
 */
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    /**
     * 비즈니스 로직 예외 처리
     * ErrorCode에 정의된 HTTP 상태 코드로 응답
     */
    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ApiResponse<Void>> handleBusinessException(BusinessException e) {
        log.warn("BusinessException: code={}, message={}", e.getErrorCode().getCode(), e.getMessage());
        ErrorCode errorCode = e.getErrorCode();

        HttpStatus status = switch (errorCode) {
            case NOT_FOUND, USER_NOT_FOUND -> HttpStatus.NOT_FOUND;
            case FORBIDDEN -> HttpStatus.FORBIDDEN;
            case UNAUTHORIZED, INVALID_TOKEN, EXPIRED_TOKEN -> HttpStatus.UNAUTHORIZED;
            case VALIDATION_ERROR, DUPLICATE_EMAIL, OUT_OF_STOCK -> HttpStatus.BAD_REQUEST;
            case DAILY_USAGE_LIMIT_EXCEEDED -> HttpStatus.TOO_MANY_REQUESTS;
            default -> HttpStatus.INTERNAL_SERVER_ERROR;
        };

        return ResponseEntity.status(status)
                .body(ApiResponse.error(errorCode));
    }

    /**
     * AI / STT 서버 장애 예외 처리
     * - AiServiceException(ErrorType.AI)     → 503 + AI_SERVER_ERROR
     * - AiServiceException(ErrorType.SPEECH) → 503 + SPEECH_SERVER_ERROR
     */
    @ExceptionHandler(AiServiceException.class)
    public ResponseEntity<ApiResponse<Void>> handleAiServiceException(AiServiceException e) {
        log.error("외부 AI 서버 오류 [{}]: {}", e.getErrorType(), e.getMessage());

        ErrorCode errorCode = (e.getErrorType() == AiServiceException.ErrorType.SPEECH)
                ? ErrorCode.SPEECH_SERVER_ERROR
                : ErrorCode.AI_SERVER_ERROR;

        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(ApiResponse.error(errorCode));
    }

    /**
     * @Valid 검증 실패 예외 처리
     * 필드별 검증 오류 메시지를 합쳐서 반환
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Void>> handleValidationException(MethodArgumentNotValidException e) {
        String message = e.getBindingResult().getFieldErrors().stream()
                .map(FieldError::getDefaultMessage)
                .collect(Collectors.joining(", "));

        log.warn("ValidationException: {}", message);
        return ResponseEntity.badRequest()
                .body(ApiResponse.error(ErrorCode.VALIDATION_ERROR.getCode(), message));
    }

    /**
     * 처리되지 않은 예외 전체 포착
     * 예상치 못한 서버 오류를 500으로 응답
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleException(Exception e) {
        log.error("Unexpected error occurred", e);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error(ErrorCode.INTERNAL_SERVER_ERROR));
    }
}
