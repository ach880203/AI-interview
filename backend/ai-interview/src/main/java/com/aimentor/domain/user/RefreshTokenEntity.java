package com.aimentor.domain.user;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * Refresh Token 엔티티 (refresh_tokens 테이블)
 * - 로그인 시 발급, 로그아웃 시 삭제
 * - POST /api/auth/refresh 에서 유효성 검증에 사용
 * - 1 사용자 = 1 토큰 (기존 토큰 덮어쓰기 방식)
 */
@Entity
@Table(name = "refresh_tokens")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class RefreshTokenEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 소유자 이메일 (unique: 1 사용자 = 1 refresh token) */
    @Column(nullable = false, unique = true, length = 100)
    private String email;

    /** JWT refresh token 문자열 */
    @Column(nullable = false, columnDefinition = "TEXT")
    private String token;

    /** 만료 시각 (DB 레벨 만료 체크용) */
    @Column(nullable = false)
    private LocalDateTime expiresAt;

    /** 토큰 갱신 시 값 교체 */
    public void updateToken(String token, LocalDateTime expiresAt) {
        this.token = token;
        this.expiresAt = expiresAt;
    }
}
