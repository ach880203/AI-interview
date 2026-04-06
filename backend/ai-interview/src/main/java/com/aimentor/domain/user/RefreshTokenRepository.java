package com.aimentor.domain.user;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

/**
 * Refresh Token JPA 리포지토리
 */
public interface RefreshTokenRepository extends JpaRepository<RefreshTokenEntity, Long> {

    /** 이메일로 refresh token 조회 */
    Optional<RefreshTokenEntity> findByEmail(String email);

    /** 토큰 문자열로 refresh token 조회 (재발급 시 유효성 검증) */
    Optional<RefreshTokenEntity> findByToken(String token);

    /** 로그아웃 시 토큰 삭제 */
    void deleteByEmail(String email);
}
