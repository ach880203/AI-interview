package com.aimentor.domain.user;

import com.aimentor.common.ApiResponse;
import com.aimentor.domain.user.dto.*;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

/**
 * 사용자 인증 API 컨트롤러
 * 기본 경로: /api/auth
 *
 * 공개 API (토큰 불필요):
 *   POST /api/auth/register - 회원가입
 *   POST /api/auth/login    - 로그인
 *   POST /api/auth/refresh  - 토큰 재발급
 *
 * 인증 필요 API (🔒 Authorization: Bearer {accessToken}):
 *   POST /api/auth/logout   - 로그아웃
 *   GET  /api/auth/me       - 내 정보
 */
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    /**
     * POST /api/auth/register - 회원가입
     * @Valid: RegisterRequestDto 필드 검증 (실패 시 GlobalExceptionHandler → 400)
     */
    @PostMapping("/register")
    public ResponseEntity<ApiResponse<UserResponseDto>> register(
            @Valid @RequestBody RegisterRequestDto request) {

        UserResponseDto response = userService.register(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(response));
    }

    /**
     * POST /api/auth/login - 로그인
     * 응답: { success: true, data: { accessToken, refreshToken, tokenType } }
     */
    @PostMapping("/login")
    public ResponseEntity<ApiResponse<TokenResponseDto>> login(
            @Valid @RequestBody LoginRequestDto request) {

        TokenResponseDto tokens = userService.login(request);
        return ResponseEntity.ok(ApiResponse.success(tokens));
    }

    /**
     * POST /api/auth/refresh - Access Token 재발급
     * 요청: { "refreshToken": "eyJhbG..." }
     * 응답: 새 accessToken + 새 refreshToken (Rotation)
     */
    @PostMapping("/refresh")
    public ResponseEntity<ApiResponse<TokenResponseDto>> refresh(
            @Valid @RequestBody RefreshRequestDto request) {

        TokenResponseDto tokens = userService.refresh(request);
        return ResponseEntity.ok(ApiResponse.success(tokens));
    }

    /**
     * POST /api/auth/kakao - 카카오 OAuth 로그인
     *
     * [흐름]
     * 1. 프론트엔드가 카카오 인가 서버에서 받은 인가 코드를 전달
     * 2. 백엔드가 카카오 토큰 교환 → 사용자 정보 조회 → 자동 가입/로그인 → JWT 발급
     * 3. 기존 로그인 응답과 동일한 형식으로 반환 (accessToken, refreshToken, user)
     */
    @PostMapping("/kakao")
    public ResponseEntity<ApiResponse<TokenResponseDto>> kakaoLogin(
            @Valid @RequestBody KakaoLoginRequestDto request) {

        TokenResponseDto tokens = userService.kakaoLogin(request.code());
        return ResponseEntity.ok(ApiResponse.success(tokens));
    }

    /**
     * POST /api/auth/logout - 로그아웃 🔒
     * SecurityConfig에서 인증 필요로 설정됨
     * @AuthenticationPrincipal: JwtAuthenticationFilter가 설정한 UserDetails
     */
    @PostMapping("/logout")
    public ResponseEntity<ApiResponse<Void>> logout(
            @AuthenticationPrincipal UserDetails userDetails) {

        userService.logout(userDetails.getUsername()); // username = email
        return ResponseEntity.ok(ApiResponse.success());
    }

    /**
     * GET /api/auth/me - 내 정보 조회 🔒
     * password 필드 제외하고 반환 (UserResponseDto)
     */
    @GetMapping("/me")
    public ResponseEntity<ApiResponse<UserResponseDto>> me(
            @AuthenticationPrincipal UserDetails userDetails) {

        UserResponseDto response = userService.getMyInfo(userDetails.getUsername());
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    /**
     * PATCH /api/auth/me - 내 기본 프로필/배송 정보 수정 🔒
     *
     * [의도]
     * 마이페이지에서 저장한 기본 배송지와 연락처를 주문서 자동 입력에 그대로 재사용합니다.
     */
    @PatchMapping("/me")
    public ResponseEntity<ApiResponse<UserResponseDto>> updateMe(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody UserProfileUpdateRequestDto request) {

        UserResponseDto response = userService.updateMyProfile(userDetails.getUsername(), request);
        return ResponseEntity.ok(ApiResponse.success(response));
    }
}
