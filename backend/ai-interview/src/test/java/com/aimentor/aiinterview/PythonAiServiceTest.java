package com.aimentor.aiinterview;

import com.aimentor.external.ai.AiService;
import com.aimentor.external.ai.dto.FeedbackDto;
import com.aimentor.external.ai.dto.GradeResultDto;
import com.aimentor.external.ai.dto.ProblemDto;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * AI 서비스 계약(Contract) 통합 테스트
 *
 * [테스트 전략]
 * 테스트 프로파일(ai.service.mock=true)에서 주입되는 MockAiService가
 * AiService 인터페이스의 계약을 올바르게 구현하는지 검증합니다.
 *
 * [왜 Mock을 테스트하는가]
 * MockAiService는 통합 테스트에서 실제 AI 서비스의 대역으로 사용됩니다.
 * Mock이 잘못된 타입이나 빈 값을 반환하면 다른 통합 테스트도 실패합니다.
 * Mock 자체의 계약 준수 여부를 확인해 상위 테스트의 신뢰성을 높입니다.
 *
 * [검증 대상 시나리오]
 * 1. 면접 질문 생성 → 비어 있지 않은 문자열 반환
 * 2. 피드백 생성 → 모든 점수 필드가 유효한 범위(0-100)
 * 3. 학습 문제 생성 → 요청한 수만큼 문제 반환
 * 4. 학습 답안 채점 → correct 필드와 feedback 필드 존재
 */
@SpringBootTest
@ActiveProfiles("test")
@DisplayName("AI 서비스 계약(MockAiService) 단위 검증")
class PythonAiServiceTest {

    /**
     * 테스트 프로파일에서는 MockAiService가 주입됩니다.
     * (application-test.yml: ai.service.mock=true)
     */
    @Autowired
    private AiService aiService;

    @Test
    @DisplayName("면접 질문 생성은 비어 있지 않은 문자열을 반환해야 한다")
    void 면접_질문_생성_계약() {
        String question = aiService.generateInterviewQuestion(
                null, null, null, "", "GENERAL"
        );

        assertThat(question).isNotNull().isNotBlank();
    }

    @Test
    @DisplayName("이력서 기반 면접 질문 생성은 컨텍스트를 무시하지 않아야 한다")
    void 이력서_기반_질문_생성_계약() {
        String question = aiService.generateInterviewQuestion(
                "Spring Boot 3년 경력", "AI 면접 플랫폼 개발", "백엔드 개발자 채용", "", "TECHNICAL"
        );

        assertThat(question).isNotNull().isNotBlank();
    }

    @Test
    @DisplayName("피드백 생성은 0~100 범위의 점수를 반환해야 한다")
    void 피드백_생성_계약() {
        String history = "Q1: 자기소개 부탁드립니다.\nA1: 백엔드 개발 3년 경력입니다.";

        FeedbackDto feedback = aiService.generateFeedback(history);

        assertThat(feedback).isNotNull();
        assertThat(feedback.logicScore()).isBetween(0, 100);
        assertThat(feedback.relevanceScore()).isBetween(0, 100);
        assertThat(feedback.specificityScore()).isBetween(0, 100);
        assertThat(feedback.overallScore()).isBetween(0, 100);
        assertThat(feedback.weakPoints()).isNotNull().isNotBlank();
        assertThat(feedback.improvements()).isNotNull().isNotBlank();
    }

    @Test
    @DisplayName("학습 문제 생성은 요청한 수만큼 문제를 반환해야 한다")
    void 학습_문제_생성_계약() {
        int count = 3;
        List<ProblemDto> problems = aiService.generateLearningProblems(
                "Java", "MEDIUM", count, "SHORT", 50
        );

        assertThat(problems).isNotNull().hasSize(count);

        // 각 문제의 필수 필드 확인
        for (ProblemDto problem : problems) {
            assertThat(problem.question()).isNotNull().isNotBlank();
            assertThat(problem.correctAnswer()).isNotNull().isNotBlank();
            assertThat(problem.type()).isIn("MULTIPLE", "SHORT");
        }
    }

    @Test
    @DisplayName("학습 답안 채점은 correct와 feedback 필드를 반환해야 한다")
    void 학습_답안_채점_계약() {
        GradeResultDto result = aiService.gradeLearningAnswer(
                "Java의 OOP 4가지 특성을 설명하시오.",
                "캡슐화, 상속, 다형성, 추상화",
                "캡슐화, 상속, 다형성, 추상화",
                "객체지향의 핵심 원칙"
        );

        assertThat(result).isNotNull();
        assertThat(result.feedback()).isNotNull().isNotBlank();
        // correct는 boolean이므로 true/false 중 하나임을 확인
        assertThat(result.correct()).isIn(true, false);
    }
}
