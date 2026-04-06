package com.aimentor.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * JWT 인증 필터
 * 모든 HTTP 요청에서 1회 실행 (OncePerRequestFilter)
 *
 * 처리 흐름:
 * 1. Authorization 헤더에서 "Bearer {token}" 추출
 * 2. JwtTokenProvider로 토큰 유효성 검증
 * 3. 이메일로 UserDetails 로드
 * 4. SecurityContext에 Authentication 저장
 * 5. 다음 필터로 요청 전달
 *
 * SecurityConfig에서 UsernamePasswordAuthenticationFilter 앞에 등록
 */
@Slf4j
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtTokenProvider jwtTokenProvider;
    private final CustomUserDetailsService userDetailsService;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        try {
            String token = extractTokenFromRequest(request);

            // 토큰이 있고 유효한 경우에만 인증 처리
            if (StringUtils.hasText(token) && jwtTokenProvider.validateToken(token)) {
                String email = jwtTokenProvider.getEmailFromToken(token);

                UserDetails userDetails = userDetailsService.loadUserByUsername(email);

                // 인증 객체 생성 (비밀번호 null: 이미 토큰으로 검증 완료)
                UsernamePasswordAuthenticationToken authentication =
                        new UsernamePasswordAuthenticationToken(
                                userDetails,
                                null,
                                userDetails.getAuthorities()
                        );
                authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));

                // SecurityContext에 인증 정보 저장 → 이후 컨트롤러에서 @AuthenticationPrincipal로 접근 가능
                SecurityContextHolder.getContext().setAuthentication(authentication);
                log.debug("JWT 인증 성공: email={}", email);
            }
        } catch (Exception e) {
            log.error("JWT 인증 처리 중 오류 발생: {}", e.getMessage());
            // 예외를 던지지 않고 계속 진행 → Security가 401 처리
        }

        filterChain.doFilter(request, response);
    }

    /**
     * Authorization 헤더에서 Bearer 토큰 추출
     * "Authorization: Bearer eyJhbG..." → "eyJhbG..."
     */
    private String extractTokenFromRequest(HttpServletRequest request) {
        String bearerToken = request.getHeader("Authorization");
        if (StringUtils.hasText(bearerToken) && bearerToken.startsWith("Bearer ")) {
            return bearerToken.substring(7); // "Bearer " 이후의 토큰 값
        }
        return null;
    }
}
