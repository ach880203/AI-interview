package com.aimentor.aiinterview;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

/**
 * Spring Boot 컨텍스트 로딩 기본 테스트
 *
 * [역할]
 * 애플리케이션 컨텍스트가 오류 없이 정상 기동되는지 확인합니다.
 * 모든 Bean 의존성이 올바르게 설정되어 있으면 이 테스트가 통과합니다.
 *
 * [프로파일]
 * test 프로파일: H2 인메모리 DB + MockAiService 사용
 */
@SpringBootTest
@ActiveProfiles("test")
@DisplayName("Spring Boot 컨텍스트 로딩 테스트")
class AiInterviewApplicationTests {

    @Test
    @DisplayName("애플리케이션 컨텍스트가 정상적으로 로딩되어야 한다")
    void 컨텍스트_로딩_성공() {
        // 컨텍스트가 로딩되면 성공
    }
}
