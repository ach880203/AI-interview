package com.aimentor.config;

import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;

/**
 * 애플리케이션 공통 Bean 설정
 *
 * PasswordEncoder를 SecurityConfig가 아닌 여기에 정의하는 이유:
 * - SecurityConfig → UserService → PasswordEncoder → SecurityConfig 순환 의존성 방지
 * - AppConfig는 Security 설정과 무관하므로 안전
 */
@Configuration
public class AppConfig {

    /**
     * BCrypt 비밀번호 인코더
     * - BCrypt: salted hash, 단방향 암호화
     * - 강도(cost): 기본값 10 (약 100ms/해시, 브루트포스 방지)
     */
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    /**
     * RestTemplate: Python AI 서버 HTTP 호출용 HTTP 클라이언트
     *
     * [타임아웃 설정 이유]
     * GPT-4o로 8~10문제를 생성할 때 재시도 + 폴백 포함 최대 120초가 소요될 수 있습니다.
     * - connectTimeout 5초  : Python 서버가 응답하지 않을 때 빠르게 실패
     * - readTimeout   120초 : AI 생성 시간을 충분히 허용 (재시도 3회 + 폴백 포함)
     *
     * @param builder Spring이 자동 주입하는 RestTemplateBuilder
     */
    @Bean
    public RestTemplate restTemplate(RestTemplateBuilder builder) {
        return builder
                .connectTimeout(Duration.ofSeconds(5))
                // 긴 면접 피드백 생성이 2분을 넘길 수 있어 공통 읽기 시간을 넉넉히 둡니다.
                .readTimeout(Duration.ofSeconds(600))
                .build();
    }
}
