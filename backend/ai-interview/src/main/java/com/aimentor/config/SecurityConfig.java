package com.aimentor.config;

import com.aimentor.security.CustomUserDetailsService;
import com.aimentor.security.JwtAuthenticationFilter;
import com.aimentor.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

/**
 * Spring Security 설정
 *
 * 핵심 결정:
 * - CSRF 비활성화: REST API + JWT 방식은 세션/쿠키 미사용
 * - STATELESS: JWT 기반으로 서버가 세션 상태를 유지하지 않음
 * - JwtAuthenticationFilter: 모든 요청에서 JWT를 먼저 검증
 * - PasswordEncoder: AppConfig에 정의 (순환 의존성 방지)
 */
@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtTokenProvider jwtTokenProvider;
    private final CustomUserDetailsService userDetailsService;

    /** application.yml의 cors.allowed-origins — 환경변수 CORS_ALLOWED_ORIGINS로 주입 */
    @Value("${cors.allowed-origins:http://localhost:5173}")
    private String[] allowedOrigins;

    @Bean
    public JwtAuthenticationFilter jwtAuthenticationFilter() {
        return new JwtAuthenticationFilter(jwtTokenProvider, userDetailsService);
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            // CORS: React 개발 서버(5173)의 요청 허용
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))

            // REST API: CSRF 비활성화
            .csrf(AbstractHttpConfigurer::disable)

            // JWT Stateless: 서버 세션 미사용
            .sessionManagement(session ->
                session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))

            // 요청별 인가 설정
            .authorizeHttpRequests(auth -> auth
                // 인증 없이 허용 (공개 API)
                .requestMatchers(
                    "/api/auth/register",
                    "/api/auth/login",
                    "/api/auth/refresh",
                    "/api/auth/kakao"
                ).permitAll()

                // 헬스체크는 브라우저, 배포 스크립트, 인프라 점검에서 바로 확인할 수 있어야 합니다.
                .requestMatchers(HttpMethod.GET, "/api/health").permitAll()

                // 업로드된 파일 정적 서빙은 인증 없이 허용
                .requestMatchers(HttpMethod.GET, "/uploads/**").permitAll()

                // 도서 목록/상세 조회는 비회원도 허용
                .requestMatchers(HttpMethod.GET, "/api/books", "/api/books/**").permitAll()

                // 공개 문의 조회 + 도움됨은 비회원도 허용
                .requestMatchers(HttpMethod.GET, "/api/support/inquiries/public").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/support/inquiries/*/helpful").permitAll()

                // FAQ 조회는 비회원도 허용
                .requestMatchers(HttpMethod.GET, "/api/support/faqs").permitAll()

                // 학습 과목 목록 조회는 비회원도 허용 (수강 신청 전 과목 탐색)
                .requestMatchers(HttpMethod.GET, "/api/learning/subjects").permitAll()

                // 도서 등록/수정/삭제/이미지 업로드는 ADMIN 전용
                .requestMatchers(HttpMethod.POST, "/api/books").hasRole("ADMIN")
                .requestMatchers(HttpMethod.POST, "/api/books/upload-cover").hasRole("ADMIN")
                .requestMatchers(HttpMethod.PUT, "/api/books/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.DELETE, "/api/books/**").hasRole("ADMIN")

                // ADMIN 전용 API
                .requestMatchers("/api/admin/**").hasRole("ADMIN")

                // 나머지 모든 요청: 인증 필요
                .anyRequest().authenticated()
            )

            // 인증 실패 핸들러: 토큰 없는 요청에 403 대신 401을 반환합니다.
            // Spring Security 기본값은 익명 사용자 접근 시 403을 반환하는데,
            // axios 인터셉터는 401을 감지해 토큰 갱신을 시도하므로 401이 반드시 내려와야 합니다.
            .exceptionHandling(ex -> ex
                .authenticationEntryPoint((request, response, authException) ->
                    response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Unauthorized"))
            )

            // JWT 필터를 UsernamePasswordAuthenticationFilter 앞에 삽입
            // 요청이 들어오면 JWT 검증 → SecurityContext 설정 → 컨트롤러 진입
            .addFilterBefore(jwtAuthenticationFilter(), UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    /**
     * CORS 설정 소스 빈
     *
     * [허용 오리진]
     * application.yml의 cors.allowed-origins 값을 읽습니다.
     * - prod: CORS_ALLOWED_ORIGINS 환경변수로 실제 도메인 주입
     * - dev:  application-dev.yml에서 localhost 포트 목록 주입
     *
     * [기타 설정]
     * - Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS
     * - Headers: 모든 헤더 허용 (Authorization 포함)
     * - Credentials: true (JWT Bearer 토큰 전송에 필요)
     */
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(List.of(allowedOrigins));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
