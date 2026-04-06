package com.aimentor.aiinterview;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

/**
 * AI 면접 플랫폼의 스프링 부트 시작점 클래스입니다.
 *
 * [역할]
 * `com.aimentor` 하위의 컴포넌트, 엔티티, 레포지토리를 한 번에 스캔해서
 * 애플리케이션 전체 기능을 실행 가능한 상태로 초기화합니다.
 *
 * [동작 방식]
 * - `@SpringBootApplication`: 기본 스프링 부트 자동 설정과 컴포넌트 스캔을 켭니다.
 * - `@EntityScan`: JPA 엔티티를 찾아 영속성 컨텍스트에 등록합니다.
 * - `@EnableJpaRepositories`: Repository 인터페이스를 실제 빈으로 생성합니다.
 * - `@EnableJpaAuditing`: 생성일/수정일 같은 감사 필드를 자동으로 채웁니다.
 */
@SpringBootApplication(scanBasePackages = "com.aimentor")
@EntityScan(basePackages = "com.aimentor")
@EnableJpaRepositories(basePackages = "com.aimentor")
@EnableJpaAuditing
public class AiInterviewApplication {

    /**
     * 자바 애플리케이션 실행 시 가장 먼저 호출되는 진입 메서드입니다.
     *
     * [동작 방식]
     * 스프링 컨테이너를 부팅하고, 등록된 설정과 빈을 모두 초기화한 뒤
     * 웹 서버와 애플리케이션 기능을 함께 실행합니다.
     *
     * @param args 실행 시 전달된 명령행 인자
     */
    public static void main(String[] args) {
        SpringApplication.run(AiInterviewApplication.class, args);
    }
}
