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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 면접 세션 소유권 통합 테스트
 *
 * [테스트 전략]
 * 사용자 A의 면접 세션에 사용자 B가 접근할 수 없음을 검증합니다.
 * 타 사용자의 세션 상세 조회, 답변 제출, 세션 종료가 모두 차단되어야 합니다.
 *
 * [검증 대상 시나리오]
 * 1. 사용자 A가 세션을 생성합니다.
 * 2. 사용자 B가 해당 세션 ID로 상세 조회 → 403 반환 (FORBIDDEN)
 * 3. 사용자 B가 해당 세션에 답변 제출 → 403 반환 (FORBIDDEN)
 * 4. 사용자 B가 해당 세션을 종료 → 403 반환 (FORBIDDEN)
 *
 * [왜 403인가]
 * InterviewService.getSessionWithOwnerCheck()는 소유자 불일치 시
 * ErrorCode.FORBIDDEN을 던지며, GlobalExceptionHandler는 이를 HTTP 403으로 매핑합니다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
@DisplayName("면접 세션 소유권 통합 테스트")
class InterviewOwnershipTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    private static final String USER_A_EMAIL = "owner-a@example.com";
    private static final String USER_B_EMAIL = "owner-b@example.com";
    private static final String PASSWORD = "password123";

    @BeforeEach
    void 두_사용자_등록() throws Exception {
        for (String email : new String[]{USER_A_EMAIL, USER_B_EMAIL}) {
            mockMvc.perform(post("/api/auth/register")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(Map.of(
                                    "email", email,
                                    "password", PASSWORD,
                                    "name", email.split("@")[0]
                            ))))
                    .andExpect(status().isCreated());
        }
    }

    @Test
    @DisplayName("다른 사용자의 면접 세션 상세를 조회하면 403이 반환되어야 한다")
    void 타사용자_세션_상세_조회_거부() throws Exception {
        String tokenA = 로그인하여_토큰_획득(USER_A_EMAIL);
        long sessionId = 세션_시작하고_세션ID_획득(tokenA);

        String tokenB = 로그인하여_토큰_획득(USER_B_EMAIL);

        mockMvc.perform(get("/api/interviews/sessions/{id}", sessionId)
                        .header("Authorization", "Bearer " + tokenB))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("다른 사용자의 세션에 답변을 제출하면 403이 반환되어야 한다")
    void 타사용자_세션_답변_제출_거부() throws Exception {
        String tokenA = 로그인하여_토큰_획득(USER_A_EMAIL);
        long sessionId = 세션_시작하고_세션ID_획득(tokenA);

        String tokenB = 로그인하여_토큰_획득(USER_B_EMAIL);
        Map<String, Object> answerRequest = Map.of(
                "orderNum", 1,
                "answerText", "타인의 세션에 침범 시도"
        );

        mockMvc.perform(post("/api/interviews/sessions/{id}/answer", sessionId)
                        .header("Authorization", "Bearer " + tokenB)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(answerRequest)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("다른 사용자의 세션을 종료하면 403이 반환되어야 한다")
    void 타사용자_세션_종료_거부() throws Exception {
        String tokenA = 로그인하여_토큰_획득(USER_A_EMAIL);
        long sessionId = 세션_시작하고_세션ID_획득(tokenA);

        String tokenB = 로그인하여_토큰_획득(USER_B_EMAIL);

        mockMvc.perform(post("/api/interviews/sessions/{id}/end", sessionId)
                        .header("Authorization", "Bearer " + tokenB))
                .andExpect(status().isForbidden());
    }

    // ──────────────────────────────────────────────────────
    // 헬퍼 메서드
    // ──────────────────────────────────────────────────────

    String 로그인하여_토큰_획득(String email) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "email", email,
                                "password", PASSWORD
                        ))))
                .andExpect(status().isOk())
                .andReturn();

        String token = objectMapper.readTree(result.getResponse().getContentAsString())
                .path("data").path("accessToken").asText();
        assertThat(token).isNotBlank();
        return token;
    }

    long 세션_시작하고_세션ID_획득(String token) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/interviews/sessions")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("questionType", "GENERAL"))))
                .andExpect(status().isCreated())
                .andReturn();

        long sessionId = objectMapper.readTree(result.getResponse().getContentAsString())
                .path("data").path("sessionId").asLong();
        assertThat(sessionId).isPositive();
        return sessionId;
    }
}
