package com.aimentor.domain.user;

import com.aimentor.common.BusinessException;
import com.aimentor.common.ErrorCode;
import com.aimentor.domain.user.dto.*;
import com.aimentor.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * 사용자 인증 비즈니스 로직 서비스
 *
 * 주요 기능:
 * - 회원가입: 이메일 중복 검사 → 비밀번호 암호화 → 저장
 * - 로그인: 비밀번호 검증 → access/refresh 토큰 발급 → DB 저장
 * - 토큰 재발급: refresh 토큰 검증 → 새 토큰 쌍 발급
 * - 로그아웃: DB에서 refresh 토큰 삭제
 */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class UserService {

    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final KakaoOAuthService kakaoOAuthService;

    // ────────────────────────────────────────────
    // 회원가입
    // ────────────────────────────────────────────

    /**
     * 회원가입
     * 1. 이메일 중복 확인
     * 2. 비밀번호 BCrypt 암호화
     * 3. users 테이블에 저장
     */
    @Transactional
    public UserResponseDto register(RegisterRequestDto request) {
        if (userRepository.existsByEmail(request.email())) {
            throw new BusinessException(ErrorCode.DUPLICATE_EMAIL);
        }

        UserEntity user = UserEntity.builder()
                .email(request.email())
                .password(passwordEncoder.encode(request.password()))
                .name(request.name())
                .phone(request.phone())
                .build();

        UserEntity saved = userRepository.save(user);
        log.info("회원가입 완료: email={}", saved.getEmail());

        return UserResponseDto.from(saved);
    }

    // ────────────────────────────────────────────
    // 로그인
    // ────────────────────────────────────────────

    /**
     * 로그인
     * 1. 이메일로 사용자 조회
     * 2. BCrypt로 비밀번호 검증
     * 3. Access Token + Refresh Token 발급
     * 4. Refresh Token DB 저장 (기존 토큰은 덮어쓰기)
     */
    @Transactional
    public TokenResponseDto login(LoginRequestDto request) {
        UserEntity user = userRepository.findByEmail(request.email())
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));

        if (!passwordEncoder.matches(request.password(), user.getPassword())) {
            // 보안: 이메일/비밀번호 오류를 같은 메시지로 처리 (계정 존재 여부 노출 방지)
            throw new BusinessException(ErrorCode.NOT_FOUND);
        }

        String accessToken = jwtTokenProvider.generateAccessToken(user.getEmail());
        String refreshToken = jwtTokenProvider.generateRefreshToken(user.getEmail());

        // Refresh Token DB 저장 (1 사용자 = 1 토큰, upsert 방식)
        saveOrUpdateRefreshToken(user.getEmail(), refreshToken);

        log.info("로그인 성공: email={}", user.getEmail());
        // user 정보를 함께 반환 → FE authStore가 /api/auth/me 없이 즉시 상태 저장 가능
        return TokenResponseDto.of(accessToken, refreshToken, UserResponseDto.from(user));
    }

    // ────────────────────────────────────────────
    // 카카오 OAuth 로그인
    // ────────────────────────────────────────────

    /**
     * 카카오 OAuth 로그인 (자동 회원가입 포함)
     *
     * [흐름]
     * 1. KakaoOAuthService를 통해 인가 코드 → 카카오 액세스 토큰 → 사용자 정보 획득
     * 2. 이메일로 기존 회원 조회
     *    - 존재: 기존 계정으로 로그인 (LOCAL 가입 계정도 카카오로 로그인 가능)
     *    - 미존재: KAKAO provider로 자동 회원가입 (비밀번호는 랜덤 UUID, 로그인 불가)
     * 3. JWT 액세스 토큰 + 리프레시 토큰 발급
     */
    @Transactional
    public TokenResponseDto kakaoLogin(String code) {
        // 카카오 인가 코드 → 액세스 토큰 → 사용자 정보
        String kakaoAccessToken = kakaoOAuthService.getAccessToken(code);
        KakaoOAuthService.KakaoUserInfo kakaoUser = kakaoOAuthService.getUserInfo(kakaoAccessToken);

        // 기존 회원 조회 또는 자동 가입
        UserEntity user = userRepository.findByEmail(kakaoUser.email())
                .orElseGet(() -> {
                    UserEntity newUser = UserEntity.builder()
                            .email(kakaoUser.email())
                            .password(passwordEncoder.encode(UUID.randomUUID().toString()))
                            .name(kakaoUser.nickname())
                            .provider("KAKAO")
                            .build();
                    log.info("카카오 OAuth 자동 회원가입: email={}", kakaoUser.email());
                    return userRepository.save(newUser);
                });

        // JWT 발급
        String accessToken = jwtTokenProvider.generateAccessToken(user.getEmail());
        String refreshToken = jwtTokenProvider.generateRefreshToken(user.getEmail());
        saveOrUpdateRefreshToken(user.getEmail(), refreshToken);

        log.info("카카오 로그인 성공: email={}, provider={}", user.getEmail(), user.getProvider());
        return TokenResponseDto.of(accessToken, refreshToken, UserResponseDto.from(user));
    }

    // ────────────────────────────────────────────
    // 토큰 재발급
    // ────────────────────────────────────────────

    /**
     * Access Token 재발급
     * 1. Refresh Token 유효성 검증 (JWT 서명 + 만료)
     * 2. DB에 저장된 토큰과 일치 여부 확인 (탈취된 토큰 차단)
     * 3. 새 Access Token + Refresh Token 발급 (Refresh Token Rotation)
     */
    @Transactional
    public TokenResponseDto refresh(RefreshRequestDto request) {
        String requestToken = request.refreshToken();

        // JWT 형식/서명/만료 검증
        if (!jwtTokenProvider.validateToken(requestToken)) {
            throw new BusinessException(ErrorCode.EXPIRED_TOKEN);
        }

        // DB 저장 토큰과 비교 (재사용 공격 방지)
        RefreshTokenEntity stored = refreshTokenRepository.findByToken(requestToken)
                .orElseThrow(() -> new BusinessException(ErrorCode.INVALID_TOKEN));

        String email = stored.getEmail();
        String newAccessToken = jwtTokenProvider.generateAccessToken(email);
        String newRefreshToken = jwtTokenProvider.generateRefreshToken(email);

        // Refresh Token Rotation: 기존 토큰 교체
        stored.updateToken(newRefreshToken,
                LocalDateTime.now().plusNanos(jwtTokenProvider.getRefreshExpiration() * 1_000_000));

        return TokenResponseDto.ofRefresh(newAccessToken, newRefreshToken);
    }

    // ────────────────────────────────────────────
    // 로그아웃
    // ────────────────────────────────────────────

    /**
     * 로그아웃
     * DB에서 Refresh Token 삭제 → 해당 토큰으로 재발급 불가
     * Access Token은 만료까지 유효하므로 클라이언트에서 삭제 필요
     */
    @Transactional
    public void logout(String email) {
        refreshTokenRepository.deleteByEmail(email);
        log.info("로그아웃 완료: email={}", email);
    }

    // ────────────────────────────────────────────
    // 내 정보 조회
    // ────────────────────────────────────────────

    /**
     * 현재 로그인한 사용자 정보 조회
     * SecurityContext의 email로 DB에서 최신 정보 조회
     */
    public UserResponseDto getMyInfo(String email) {
        UserEntity user = userRepository.findByEmail(email)
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));
        return UserResponseDto.from(user);
    }

    /**
     * 로그인 사용자의 기본 프로필과 배송 정보를 수정합니다.
     *
     * [의도]
     * 주문서 자동 입력이 이 값을 그대로 읽어 가므로,
     * 마이페이지 저장과 주문서 프리필이 서로 다른 규칙으로 어긋나지 않게 같은 서비스에서 정리합니다.
     */
    @Transactional
    public UserResponseDto updateMyProfile(String email, UserProfileUpdateRequestDto request) {
        UserEntity user = userRepository.findByEmail(email)
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));

        user.updateProfile(
                request.name().trim(),
                normalizeBlank(request.phone()),
                normalizeBlank(request.shippingPostalCode()),
                normalizeBlank(request.shippingAddress()),
                normalizeBlank(request.shippingDetailAddress())
        );

        return UserResponseDto.from(user);
    }

    // ────────────────────────────────────────────
    // 관리자용
    // ────────────────────────────────────────────

    /**
     * ID로 사용자 조회 (관리자 API용)
     */
    public UserEntity findById(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));
    }

    /**
     * 사용자 권한 변경 (ADMIN 전용)
     */
    @Transactional
    public void updateUserRole(Long userId, UserRole role) {
        UserEntity user = findById(userId);
        user.updateRole(role);
    }

    // ────────────────────────────────────────────
    // 내부 메서드
    // ────────────────────────────────────────────

    /** Refresh Token 저장 또는 갱신 (upsert) */
    private void saveOrUpdateRefreshToken(String email, String token) {
        LocalDateTime expiresAt = LocalDateTime.now()
                .plusNanos(jwtTokenProvider.getRefreshExpiration() * 1_000_000);

        refreshTokenRepository.findByEmail(email)
                .ifPresentOrElse(
                        existing -> existing.updateToken(token, expiresAt), // 기존 토큰 갱신
                        () -> refreshTokenRepository.save(                  // 신규 토큰 생성
                                RefreshTokenEntity.builder()
                                        .email(email)
                                        .token(token)
                                        .expiresAt(expiresAt)
                                        .build()
                        )
                );
    }

    /**
     * 공백만 들어온 입력은 null로 정리합니다.
     *
     * [이유]
     * 프런트에서는 null 여부만으로 "저장된 기본 배송정보가 있는지"를 쉽게 판단할 수 있습니다.
     */
    private String normalizeBlank(String value) {
        if (value == null) {
            return null;
        }

        String trimmedValue = value.trim();
        return trimmedValue.isEmpty() ? null : trimmedValue;
    }
}
