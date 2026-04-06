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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 구독 결제 준비와 결제 결과 반영 흐름을 검증하는 통합 테스트입니다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
@DisplayName("구독 결제 흐름 통합 테스트")
class SubscriptionFlowTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    private static final String TEST_EMAIL = "subscription-test@example.com";
    private static final String TEST_PASSWORD = "password123";

    @BeforeEach
    void 테스트_사용자_준비() throws Exception {
        Map<String, Object> registerRequest = Map.of(
                "email", TEST_EMAIL,
                "password", TEST_PASSWORD,
                "name", "구독 테스트 사용자",
                "phone", "010-2222-3333"
        );

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(registerRequest)))
                .andExpect(status().isCreated());
    }

    @Test
    @DisplayName("구독 생성 후 승인하면 현재 구독 상태가 ACTIVE로 보인다")
    void 구독_생성_후_승인하면_ACTIVE가_된다() throws Exception {
        String accessToken = 로그인하고_토큰을_가져온다();

        long subscriptionId = 구독을_생성하고_ID를_가져온다(accessToken, "monthly");

        mockMvc.perform(patch("/api/subscriptions/{id}/payment", subscriptionId)
                        .header("Authorization", "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "resultType", "APPROVED"
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("ACTIVE"))
                .andExpect(jsonPath("$.data.active").value(true));

        mockMvc.perform(get("/api/subscriptions/me")
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.planKey").value("monthly"))
                .andExpect(jsonPath("$.data.status").value("ACTIVE"))
                .andExpect(jsonPath("$.data.active").value(true));
    }

    @Test
    @DisplayName("최신 결제가 실패해도 기존 활성 구독이 현재 구독으로 유지된다")
    void 실패한_최신_결제보다_기존_ACTIVE가_우선이다() throws Exception {
        String accessToken = 로그인하고_토큰을_가져온다();

        long activeSubscriptionId = 구독을_생성하고_ID를_가져온다(accessToken, "monthly");
        mockMvc.perform(patch("/api/subscriptions/{id}/payment", activeSubscriptionId)
                        .header("Authorization", "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "resultType", "APPROVED"
                        ))))
                .andExpect(status().isOk());

        long failedSubscriptionId = 구독을_생성하고_ID를_가져온다(accessToken, "yearly");
        mockMvc.perform(patch("/api/subscriptions/{id}/payment", failedSubscriptionId)
                        .header("Authorization", "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "resultType", "FAILED"
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("PAYMENT_FAILED"))
                .andExpect(jsonPath("$.data.active").value(false));

        mockMvc.perform(get("/api/subscriptions/me")
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.planKey").value("monthly"))
                .andExpect(jsonPath("$.data.status").value("ACTIVE"))
                .andExpect(jsonPath("$.data.active").value(true));
    }

    /**
     * 로그인 후 accessToken을 반환합니다.
     */
    private String 로그인하고_토큰을_가져온다() throws Exception {
        Map<String, Object> loginRequest = Map.of(
                "email", TEST_EMAIL,
                "password", TEST_PASSWORD
        );

        MvcResult result = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loginRequest)))
                .andExpect(status().isOk())
                .andReturn();

        String accessToken = objectMapper.readTree(result.getResponse().getContentAsString())
                .path("data")
                .path("accessToken")
                .asText();

        assertThat(accessToken).isNotBlank();
        return accessToken;
    }

    /**
     * 결제 준비 단계의 구독을 만들고 ID를 반환합니다.
     */
    private long 구독을_생성하고_ID를_가져온다(String accessToken, String planKey) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/subscriptions")
                        .header("Authorization", "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "planKey", planKey,
                                "paymentMethod", "KAKAOPAY"
                        ))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.status").value("PENDING"))
                .andExpect(jsonPath("$.data.active").value(false))
                .andReturn();

        long subscriptionId = objectMapper.readTree(result.getResponse().getContentAsString())
                .path("data")
                .path("id")
                .asLong();

        assertThat(subscriptionId).isPositive();
        return subscriptionId;
    }
}
