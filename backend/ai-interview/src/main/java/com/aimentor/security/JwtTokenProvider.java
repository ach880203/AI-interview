package com.aimentor.security;

import io.jsonwebtoken.*;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.io.DecodingException;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

/**
 * JWT 토큰 생성 / 파싱 / 검증 유틸리티
 *
 * 토큰 구조:
 *   Header: { alg: HS256, typ: JWT }
 *   Payload: { sub: email, iat: 발급시각, exp: 만료시각 }
 *   Signature: HMAC-SHA256(secret)
 *
 * JJWT 0.12.x API 사용
 */
@Slf4j
@Component
public class JwtTokenProvider {

    private final SecretKey secretKey;
    private final long accessExpiration;
    private final long refreshExpiration;

    public JwtTokenProvider(
            @Value("${jwt.secret}") String secret,
            @Value("${jwt.access-expiration}") long accessExpiration,
            @Value("${jwt.refresh-expiration}") long refreshExpiration
    ) {
        // [호환성]
        // 기존 application.yml 기본값은 Base64 문자열이고,
        // .env 에서는 사람이 읽기 쉬운 일반 문자열을 넣어둔 경우가 있습니다.
        // 둘 중 어느 형식이 들어와도 서버가 안전하게 부팅되도록
        // Base64 디코딩이 실패하면 UTF-8 원문 바이트를 그대로 HMAC 키로 사용합니다.
        this.secretKey = Keys.hmacShaKeyFor(resolveSecretBytes(secret));
        this.accessExpiration = accessExpiration;
        this.refreshExpiration = refreshExpiration;
    }

    /**
     * JWT 시크릿 문자열을 실제 서명 키 바이트로 변환합니다.
     */
    private byte[] resolveSecretBytes(String secret) {
        try {
            return Decoders.BASE64.decode(secret);
        } catch (IllegalArgumentException | DecodingException decodeError) {
            log.warn("JWT_SECRET가 Base64 형식이 아니어서 UTF-8 원문 키로 처리합니다.");
            return secret.getBytes(StandardCharsets.UTF_8);
        }
    }

    /**
     * Access Token 생성 (30분)
     * subject에 email 저장 → 이후 필터에서 이메일로 사용자 조회
     */
    public String generateAccessToken(String email) {
        return buildToken(email, accessExpiration);
    }

    /**
     * Refresh Token 생성 (7일)
     * DB의 refresh_tokens 테이블에도 함께 저장
     */
    public String generateRefreshToken(String email) {
        return buildToken(email, refreshExpiration);
    }

    private String buildToken(String email, long expiration) {
        Date now = new Date();
        Date expiryDate = new Date(now.getTime() + expiration);

        return Jwts.builder()
                .subject(email)           // 토큰 주체 (이메일)
                .issuedAt(now)            // 발급 시각
                .expiration(expiryDate)   // 만료 시각
                .signWith(secretKey)      // HMAC-SHA256 서명
                .compact();
    }

    /**
     * 토큰에서 이메일(subject) 추출
     */
    public String getEmailFromToken(String token) {
        return parseClaims(token).getSubject();
    }

    /**
     * 토큰 유효성 검증
     * 만료 / 서명 불일치 / 형식 오류 등 모두 false 반환
     */
    public boolean validateToken(String token) {
        try {
            parseClaims(token);
            return true;
        } catch (ExpiredJwtException e) {
            log.warn("만료된 JWT 토큰: {}", e.getMessage());
        } catch (UnsupportedJwtException e) {
            log.warn("지원하지 않는 JWT 토큰: {}", e.getMessage());
        } catch (MalformedJwtException e) {
            log.warn("잘못된 형식의 JWT 토큰: {}", e.getMessage());
        } catch (SecurityException e) {
            log.warn("JWT 서명 오류: {}", e.getMessage());
        } catch (IllegalArgumentException e) {
            log.warn("JWT 토큰이 비어있습니다: {}", e.getMessage());
        }
        return false;
    }

    /** Claims(페이로드) 파싱 */
    private Claims parseClaims(String token) {
        return Jwts.parser()
                .verifyWith(secretKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    /** Refresh Token 만료 기간 (ms) 반환 - RefreshToken 엔티티 expiresAt 계산용 */
    public long getRefreshExpiration() {
        return refreshExpiration;
    }
}
