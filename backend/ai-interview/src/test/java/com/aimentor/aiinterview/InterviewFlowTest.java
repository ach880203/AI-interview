package com.aimentor.aiinterview;

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

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 면접 전체 흐름 통합 테스트
 *
 * [테스트 전략]
 * MockAiService(ai.service.mock=true, application-test.yml)를 사용하여
 * Python AI 서버 없이도 면접 전체 흐름을 검증합니다.
 *
 * [검증 대상 시나리오]
 * 1. 세션 시작 → 첫 질문 반환 확인
 * 2. 답변 제출 → 다음 질문 반환 확인
 * 3. 세션 종료 → 피드백 생성 확인
 * 4. 피드백 조회 → 저장된 피드백 반환 확인
 * 5. 이미 종료된 세션에 답변 제출 → 오류 응답 확인
 *
 * [왜 MockAiService를 사용하는가]
 * 단위/통합 테스트에서 실제 OpenAI API를 호출하면:
 * - API 비용 발생
 * - 테스트 실행 시간이 불규칙
 * - 네트워크 장애 시 테스트 실패
 * MockAiService는 고정된 응답을 반환해 빠르고 안정적인 테스트를 보장합니다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
@DisplayName("면접 전체 흐름 통합 테스트")
class InterviewFlowTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    private static final String TEST_EMAIL = "interview-test@example.com";
    private static final String TEST_PASSWORD = "password123";

    /** 각 테스트 전에 테스트 사용자를 등록합니다. */
    @BeforeEach
    void 테스트_사용자_등록() throws Exception {
        Map<String, Object> request = Map.of(
                "email", TEST_EMAIL,
                "password", TEST_PASSWORD,
                "name", "면접테스트"
        );

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated());
    }

    // ──────────────────────────────────────────────────────
    // 세션 시작
    // ──────────────────────────────────────────────────────

    @Test
    @DisplayName("면접 세션 시작 시 첫 번째 질문이 반환되어야 한다")
    void 세션_시작_첫_질문_반환() throws Exception {
        String token = 로그인하여_토큰_획득();

        // 이력서/자소서/채용공고 없이 일반 질문으로 세션 시작
        Map<String, Object> startRequest = Map.of("questionType", "GENERAL");

        mockMvc.perform(post("/api/interviews/sessions")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(startRequest)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.sessionId").isNumber())
                // MockAiService가 항상 고정된 질문을 반환하므로 비어 있지 않아야 함
                .andExpect(jsonPath("$.data.firstQuestion.question").isNotEmpty());
    }

    @Test
    @DisplayName("인증 없이 세션 시작 시 401이 반환되어야 한다")
    void 인증_없이_세션_시작_거부() throws Exception {
        Map<String, Object> startRequest = Map.of("questionType", "GENERAL");

        mockMvc.perform(post("/api/interviews/sessions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(startRequest)))
                .andExpect(status().isUnauthorized());
    }

    // ──────────────────────────────────────────────────────
    // 전체 흐름: 세션 시작 → 답변 제출 → 면접 종료 → 피드백 조회
    // ──────────────────────────────────────────────────────

    @Test
    @DisplayName("면접 전체 흐름 — 세션 시작부터 피드백 조회까지 정상 동작해야 한다")
    void 면접_전체_흐름() throws Exception {
        String token = 로그인하여_토큰_획득();

        // ── 1단계: 세션 시작 ────────────────────────────────
        long sessionId = 세션_시작하고_세션ID_획득(token);

        // ── 2단계: 1번 질문에 답변 제출 ─────────────────────
        Map<String, Object> answerRequest = Map.of(
                "orderNum", 1,
                "answerText", "저는 백엔드 개발자로 Java와 Spring Boot를 주로 사용합니다. "
                        + "최근에는 AI 면접 플랫폼 프로젝트에 참여하고 있습니다."
        );

        mockMvc.perform(post("/api/interviews/sessions/{id}/answer", sessionId)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(answerRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        // ── 3단계: 세션 종료 (피드백 생성) ──────────────────
        mockMvc.perform(post("/api/interviews/sessions/{id}/end", sessionId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                // MockAiService는 overallScore=70을 반환함
                .andExpect(jsonPath("$.data.overallScore").value(70));

        // 세션 상세에도 부분 완료 메타데이터가 저장되어야
        // 결과 재조회와 새로고침 복구 시 프런트 임시 상태에 의존하지 않게 됩니다.
        mockMvc.perform(get("/api/interviews/sessions/{id}", sessionId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.plannedQuestionCount").value(5))
                .andExpect(jsonPath("$.data.answeredQuestionCount").value(1))
                .andExpect(jsonPath("$.data.partialCompleted").value(true));

        // ── 4단계: 피드백 조회 ───────────────────────────────
        mockMvc.perform(get("/api/interviews/sessions/{id}/feedback", sessionId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.overallScore").isNumber())
                .andExpect(jsonPath("$.data.weakPoints").isNotEmpty())
                .andExpect(jsonPath("$.data.improvements").isNotEmpty());
    }

    @Test
    @DisplayName("이미 종료된 세션에 답변 제출 시 오류가 반환되어야 한다")
    void 종료된_세션에_답변_제출_실패() throws Exception {
        String token = 로그인하여_토큰_획득();
        long sessionId = 세션_시작하고_세션ID_획득(token);

        // 세션 종료
        mockMvc.perform(post("/api/interviews/sessions/{id}/end", sessionId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());

        // 종료된 세션에 다시 답변 제출 시도
        Map<String, Object> answerRequest = Map.of("orderNum", 1, "answerText", "늦은 답변");

        mockMvc.perform(post("/api/interviews/sessions/{id}/answer", sessionId)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(answerRequest)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));
    }

    // ──────────────────────────────────────────────────────
    // 헬퍼 메서드
    // ──────────────────────────────────────────────────────

    /**
     * 로그인 헬퍼 — accessToken을 반환합니다.
     */
    String 로그인하여_토큰_획득() throws Exception {
        Map<String, Object> loginRequest = Map.of(
                "email", TEST_EMAIL,
                "password", TEST_PASSWORD
        );

        MvcResult result = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loginRequest)))
                .andExpect(status().isOk())
                .andReturn();

        String token = objectMapper.readTree(result.getResponse().getContentAsString())
                .path("data").path("accessToken").asText();
        assertThat(token).isNotBlank();
        return token;
    }

    /**
     * 세션 시작 헬퍼 — 생성된 sessionId를 반환합니다.
     *
     * @param token 인증 토큰
     * @return 생성된 세션 ID
     */
    long 세션_시작하고_세션ID_획득(String token) throws Exception {
        Map<String, Object> startRequest = Map.of("questionType", "GENERAL");

        MvcResult result = mockMvc.perform(post("/api/interviews/sessions")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(startRequest)))
                .andExpect(status().isCreated())
                .andReturn();

        long sessionId = objectMapper.readTree(result.getResponse().getContentAsString())
                .path("data").path("sessionId").asLong();
        assertThat(sessionId).isPositive();
        return sessionId;
    }
}
