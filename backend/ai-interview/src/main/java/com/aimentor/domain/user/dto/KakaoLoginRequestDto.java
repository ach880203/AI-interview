package com.aimentor.domain.user.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * 카카오 OAuth 로그인 요청 DTO
 *
 * [역할]
 * 프론트엔드가 카카오 인가 서버로부터 받은 인가 코드를 전달합니다.
 * 백엔드는 이 코드로 카카오 토큰 교환 → 사용자 정보 조회 → JWT 발급을 수행합니다.
 */
public record KakaoLoginRequestDto(
        @NotBlank(message = "인가 코드는 필수입니다.")
        String code
) {}
