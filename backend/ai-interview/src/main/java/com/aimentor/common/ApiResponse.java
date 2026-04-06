package com.aimentor.common;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Builder;
import lombok.Getter;

/**
 * 공통 API 응답 형식
 * 성공: { "success": true, "data": {...} }
 * 실패: { "success": false, "error": { "code": "...", "message": "..." } }
 */
@Getter
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ApiResponse<T> {

    private final boolean success;
    private final T data;
    private final ErrorInfo error;

    /** 데이터와 함께 성공 응답 */
    public static <T> ApiResponse<T> success(T data) {
        return ApiResponse.<T>builder()
                .success(true)
                .data(data)
                .build();
    }

    /** 데이터 없는 성공 응답 (삭제 등) */
    public static <Void> ApiResponse<Void> success() {
        return ApiResponse.<Void>builder()
                .success(true)
                .build();
    }

    /** 에러 코드 기반 실패 응답 */
    public static <T> ApiResponse<T> error(ErrorCode errorCode) {
        return ApiResponse.<T>builder()
                .success(false)
                .error(new ErrorInfo(errorCode.getCode(), errorCode.getMessage()))
                .build();
    }

    /** 커스텀 메시지 실패 응답 */
    public static <T> ApiResponse<T> error(String code, String message) {
        return ApiResponse.<T>builder()
                .success(false)
                .error(new ErrorInfo(code, message))
                .build();
    }

    /**
     * 에러 정보 내부 클래스
     * { "code": "NOT_FOUND", "message": "리소스를 찾을 수 없습니다." }
     */
    @Getter
    public static class ErrorInfo {
        private final String code;
        private final String message;

        public ErrorInfo(String code, String message) {
            this.code = code;
            this.message = message;
        }
    }
}
