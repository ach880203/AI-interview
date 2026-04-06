package com.aimentor.domain.user.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * 토큰 재발급 요청 DTO
 * 클라이언트가 refreshToken을 Body로 전송
 */
public record RefreshRequestDto(

        @NotBlank(message = "refresh token은 필수입니다.")
        String refreshToken
) {}
