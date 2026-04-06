package com.aimentor.domain.user.dto;

/**
 * 토큰 응답 DTO
 * 로그인/재발급 결과를 함께 반환합니다.
 *
 * [역할]
 * - accessToken: API 호출용 액세스 토큰
 * - refreshToken: 액세스 토큰 재발급용 토큰
 * - tokenType: Authorization 헤더 접두사
 * - user: 로그인 직후 프런트 상태를 바로 채우기 위한 사용자 정보
 */
public record TokenResponseDto(
        String accessToken,
        String refreshToken,
        String tokenType,
        UserResponseDto user
) {
    public static TokenResponseDto of(String accessToken, String refreshToken) {
        return new TokenResponseDto(accessToken, refreshToken, "Bearer", null);
    }

    public static TokenResponseDto of(String accessToken, String refreshToken, UserResponseDto user) {
        return new TokenResponseDto(accessToken, refreshToken, "Bearer", user);
    }

    public static TokenResponseDto ofRefresh(String accessToken, String refreshToken) {
        return new TokenResponseDto(accessToken, refreshToken, "Bearer", null);
    }
}
