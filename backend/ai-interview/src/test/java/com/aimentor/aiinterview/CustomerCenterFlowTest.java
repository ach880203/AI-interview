package com.aimentor.aiinterview;

import com.aimentor.domain.user.UserEntity;
import com.aimentor.domain.user.UserRepository;
import com.aimentor.domain.user.UserRole;
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
 * 고객센터 문의 흐름 통합 테스트입니다.
 *
 * [검증 범위]
 * 1. 일반 사용자가 문의를 등록할 수 있는지
 * 2. 사용자가 자기 문의 목록만 조회할 수 있는지
 * 3. 관리자가 전체 문의를 보고 답변을 저장할 수 있는지
 * 4. 답변 후 사용자 화면에도 답변 완료 상태가 반영되는지
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
@DisplayName("고객센터 문의 흐름 통합 테스트")
class CustomerCenterFlowTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    private static final String USER_EMAIL = "support-user@example.com";
    private static final String USER_PASSWORD = "password123";
    private static final String ADMIN_EMAIL = "support-admin@example.com";
    private static final String ADMIN_PASSWORD = "password123";

    @BeforeEach
    void 테스트_사용자_준비() throws Exception {
        registerUser(USER_EMAIL, USER_PASSWORD, "문의 사용자");
        registerUser(ADMIN_EMAIL, ADMIN_PASSWORD, "문의 관리자");

        UserEntity adminUser = userRepository.findByEmail(ADMIN_EMAIL).orElseThrow();
        adminUser.updateRole(UserRole.ADMIN);
    }

    @Test
    @DisplayName("사용자는 고객센터 문의를 등록하고 자신의 목록에서 확인할 수 있어야 한다")
    void 사용자_문의_등록과_목록_조회() throws Exception {
        String userAccessToken = loginAndGetAccessToken(USER_EMAIL, USER_PASSWORD);

        Map<String, String> createRequest = Map.of(
                "title", "면접 음성이 늦게 나와요",
                "content", "질문은 보이는데 음성 출력까지 몇 초 정도 기다려야 하는지 궁금합니다."
        );

        mockMvc.perform(post("/api/support/inquiries")
                        .header("Authorization", "Bearer " + userAccessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(createRequest)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.status").value("답변 대기"))
                .andExpect(jsonPath("$.data.answered").value(false));

        mockMvc.perform(get("/api/support/inquiries")
                        .header("Authorization", "Bearer " + userAccessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data[0].title").value("면접 음성이 늦게 나와요"))
                .andExpect(jsonPath("$.data[0].userEmail").value(USER_EMAIL));
    }

    @Test
    @DisplayName("관리자는 문의에 답변할 수 있고 사용자는 답변 완료 상태를 다시 볼 수 있어야 한다")
    void 관리자_문의_답변_후_사용자_조회() throws Exception {
        String userAccessToken = loginAndGetAccessToken(USER_EMAIL, USER_PASSWORD);
        String adminAccessToken = loginAndGetAccessToken(ADMIN_EMAIL, ADMIN_PASSWORD);

        Map<String, String> createRequest = Map.of(
                "title", "학습 결과가 저장되나요?",
                "content", "중간에 종료해도 지금까지 푼 문제 기준으로 결과를 다시 볼 수 있는지 알고 싶습니다."
        );

        mockMvc.perform(post("/api/support/inquiries")
                        .header("Authorization", "Bearer " + userAccessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(createRequest)))
                .andExpect(status().isCreated());

        MvcResult inquiryListResult = mockMvc.perform(get("/api/admin/inquiries")
                        .header("Authorization", "Bearer " + adminAccessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data[0].status").value("답변 대기"))
                .andReturn();

        Long inquiryId = objectMapper.readTree(inquiryListResult.getResponse().getContentAsString())
                .path("data")
                .path(0)
                .path("id")
                .asLong();

        Map<String, String> replyRequest = Map.of(
                "reply", "네, 현재는 완료한 문제 기준으로 부분 평가 결과를 확인할 수 있도록 개선 중입니다."
        );

        mockMvc.perform(patch("/api/admin/inquiries/{id}/reply", inquiryId)
                        .header("Authorization", "Bearer " + adminAccessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(replyRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.status").value("답변 완료"))
                .andExpect(jsonPath("$.data.answered").value(true));

        mockMvc.perform(get("/api/support/inquiries")
                        .header("Authorization", "Bearer " + userAccessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].status").value("답변 완료"))
                .andExpect(jsonPath("$.data[0].reply").value("네, 현재는 완료한 문제 기준으로 부분 평가 결과를 확인할 수 있도록 개선 중입니다."));
    }

    private void registerUser(String email, String password, String name) throws Exception {
        Map<String, String> registerRequest = Map.of(
                "email", email,
                "password", password,
                "name", name
        );

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(registerRequest)))
                .andExpect(status().isCreated());
    }

    /**
     * 테스트에서 공통으로 로그인하고 accessToken만 뽑아 씁니다.
     * 실제 흐름과 같은 JWT 인증을 타게 해야 권한 제약도 함께 검증됩니다.
     */
    private String loginAndGetAccessToken(String email, String password) throws Exception {
        Map<String, String> loginRequest = Map.of(
                "email", email,
                "password", password
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
}
