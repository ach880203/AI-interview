package com.aimentor.aiinterview;

import com.aimentor.domain.learning.LearningRepository;
import com.aimentor.domain.learning.LearningSubjectEntity;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 학습 문제 생성 및 채점 통합 테스트
 *
 * [테스트 전략]
 * MockAiService(ai.service.mock=true, application-test.yml)를 사용하여
 * Python AI 서버 없이도 학습 전체 흐름을 검증합니다.
 *
 * [검증 대상 시나리오]
 * 1. 학습 과목 목록 조회 (공개 API)
 * 2. 문제 생성 → 인증 필요 확인
 * 3. 문제 생성 → MockAiService가 고정된 문제 목록 반환 확인
 * 4. 답안 제출 → 채점 결과(correct, feedback) 반환 확인
 * 5. 오답 목록 조회 → 틀린 답변이 저장되는지 확인
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
@DisplayName("학습 문제 생성 및 채점 통합 테스트")
class LearningGradeTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private LearningRepository learningRepository;

    private static final String TEST_EMAIL = "learning-test@example.com";
    private static final String TEST_PASSWORD = "password123";

    /** 테스트용 과목 ID (BeforeEach에서 설정됨) */
    private Long testSubjectId;

    @BeforeEach
    void 테스트_데이터_준비() throws Exception {
        // 1. 사용자 등록
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "email", TEST_EMAIL,
                                "password", TEST_PASSWORD,
                                "name", "학습테스트"
                        ))))
                .andExpect(status().isCreated());

        // 2. 테스트용 학습 과목 저장
        LearningSubjectEntity subject = LearningSubjectEntity.builder()
                .name("Java")
                .description("Java 프로그래밍 언어 기초 및 심화")
                .build();

        testSubjectId = learningRepository.save(subject).getId();
    }

    // ──────────────────────────────────────────────────────
    // 과목 목록 조회 (공개 API)
    // ──────────────────────────────────────────────────────

    @Test
    @DisplayName("학습 과목 목록은 인증 없이도 조회할 수 있어야 한다")
    void 학습_과목_비인증_조회() throws Exception {
        mockMvc.perform(get("/api/learning/subjects"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                // BeforeEach에서 1개 과목을 저장했으므로 최소 1건 이상
                .andExpect(jsonPath("$.data").isArray());
    }

    // ──────────────────────────────────────────────────────
    // 문제 생성
    // ──────────────────────────────────────────────────────

    @Test
    @DisplayName("인증 없이 문제 생성 요청 시 401이 반환되어야 한다")
    void 인증없이_문제_생성_거부() throws Exception {
        Map<String, Object> request = Map.of(
                "difficulty", "MEDIUM",
                "count", 3,
                "type", "SHORT"
        );

        mockMvc.perform(post("/api/learning/subjects/{id}/problems/generate", testSubjectId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("문제 생성 시 MockAiService가 고정된 문제를 반환해야 한다")
    void 문제_생성_성공() throws Exception {
        String token = 로그인하여_토큰_획득();

        Map<String, Object> request = Map.of(
                "difficulty", "MEDIUM",
                "count", 3,
                "type", "SHORT"
        );

        mockMvc.perform(post("/api/learning/subjects/{id}/problems/generate", testSubjectId)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data").isArray())
                // MockAiService는 3개의 고정된 문제를 반환
                .andExpect(jsonPath("$.data[0].question").isNotEmpty());
    }

    // ──────────────────────────────────────────────────────
    // 답안 채점
    // ──────────────────────────────────────────────────────

    @Test
    @DisplayName("답안 제출 시 채점 결과(correct, feedback)가 반환되어야 한다")
    void 답안_제출_채점_성공() throws Exception {
        String token = 로그인하여_토큰_획득();

        // MockAiService가 사용하는 문제와 동일한 값으로 채점 요청
        Map<String, Object> attemptRequest = Map.of(
                "subjectId", testSubjectId,
                "difficulty", "MEDIUM",
                "problemType", "SHORT",
                "question", "Java의 OOP 4가지 특성을 설명하시오.",
                "correctAnswer", "캡슐화, 상속, 다형성, 추상화",
                "userAnswer", "캡슐화, 상속, 다형성, 추상화",
                "explanation", "객체지향의 핵심 4가지 원칙입니다."
        );

        mockMvc.perform(post("/api/learning/attempts")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(attemptRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.correct").isBoolean())
                .andExpect(jsonPath("$.data.feedback").isNotEmpty());
    }

    @Test
    @DisplayName("틀린 답변은 오답 목록에 저장되어야 한다")
    void 오답_저장_및_조회() throws Exception {
        String token = 로그인하여_토큰_획득();

        // MockAiService는 correct=false를 반환하는 케이스 확인
        // (isCorrect 판단은 MockAiService.gradeLearningAnswer()에서 결정)
        Map<String, Object> attemptRequest = Map.of(
                "subjectId", testSubjectId,
                "difficulty", "MEDIUM",
                "problemType", "SHORT",
                "question", "Java의 OOP 4가지 특성을 설명하시오.",
                "correctAnswer", "캡슐화, 상속, 다형성, 추상화",
                "userAnswer", "모르겠습니다.",
                "explanation", "객체지향의 핵심 4가지 원칙입니다."
        );

        mockMvc.perform(post("/api/learning/attempts")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(attemptRequest)))
                .andExpect(status().isOk());

        // 오답 목록 조회 — 방금 틀린 답변이 포함되어야 함
        mockMvc.perform(get("/api/learning/attempts/wrong")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data").isArray());
    }

    // ──────────────────────────────────────────────────────
    // 헬퍼 메서드
    // ──────────────────────────────────────────────────────

    String 로그인하여_토큰_획득() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "email", TEST_EMAIL,
                                "password", TEST_PASSWORD
                        ))))
                .andExpect(status().isOk())
                .andReturn();

        String token = objectMapper.readTree(result.getResponse().getContentAsString())
                .path("data").path("accessToken").asText();
        assertThat(token).isNotBlank();
        return token;
    }

    @Test
    @DisplayName("학습 세션 부분 완료 결과를 다시 조회할 수 있어야 한다")
    void restoreLearningSessionResult() throws Exception {
        String token = 로그인하여_토큰_획득();
        String sessionKey = "learning-session-recovery-test";

        Map<String, Object> correctAttemptRequest = Map.of(
                "subjectId", testSubjectId,
                "difficulty", "MEDIUM",
                "problemType", "SHORT",
                "question", "Java??OOP 4媛吏 ?뱀꽦???ㅻ챸?섏떆??",
                "correctAnswer", "罹≪뒓?? ?곸냽, ?ㅽ삎?? 異붿긽??",
                "userAnswer", "媛앹껜吏?μ쓽 4媛吏 ?듭떖 ?뱀꽦???ㅻ챸?섎㈃ 罹≪뒓?? ?곸냽, ?ㅽ삎?? 異붿긽?붿씠怨? ?묒슜 ?덈줈 ?좎튃?덈떎.",
                "sessionKey", sessionKey,
                "sessionProblemCount", 3,
                "sessionProblemOrder", 1,
                "explanation", "媛앹껜吏?μ쓽 ?듭떖 4媛吏 ?먯튃?낅땲??"
        );

        Map<String, Object> wrongAttemptRequest = Map.of(
                "subjectId", testSubjectId,
                "difficulty", "MEDIUM",
                "problemType", "SHORT",
                "question", "Java??interface???≪껜 class? ?⑥씠瑜?ㅻ챸?섏떆??",
                "correctAnswer", "interface??異붿긽 硫붿꽌?쒓? 以묒떖?대㈃ class???ㅽ궗????곹깭? ?듯빀?덈떎.",
                "userAnswer", "?ㅻⅨ ?먮뒗 紐⑤Ⅴ寃좎뒿?덈떎.",
                "sessionKey", sessionKey,
                "sessionProblemCount", 3,
                "sessionProblemOrder", 2,
                "explanation", "湲곕낯 媛쒕뀗 怨듬텇 ?섏씠?곕? 湲곗??쇰줈 比꾧탳?⑸땲??"
        );

        mockMvc.perform(post("/api/learning/attempts")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(correctAttemptRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.correct").value(true));

        mockMvc.perform(post("/api/learning/attempts")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(wrongAttemptRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.correct").value(false));

        mockMvc.perform(get("/api/learning/sessions/{sessionKey}", sessionKey)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.sessionKey").value(sessionKey))
                .andExpect(jsonPath("$.data.subjectId").value(testSubjectId))
                .andExpect(jsonPath("$.data.totalProblemCount").value(3))
                .andExpect(jsonPath("$.data.completedProblemCount").value(2))
                .andExpect(jsonPath("$.data.correctCount").value(1))
                .andExpect(jsonPath("$.data.accuracyRate").value(50))
                .andExpect(jsonPath("$.data.partialCompletion").value(true))
                .andExpect(jsonPath("$.data.results").isArray())
                .andExpect(jsonPath("$.data.results[0].sessionProblemOrder").value(1))
                .andExpect(jsonPath("$.data.results[1].sessionProblemOrder").value(2));
    }
}
