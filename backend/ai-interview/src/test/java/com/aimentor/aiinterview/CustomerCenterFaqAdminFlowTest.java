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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 고객센터 FAQ 관리자 흐름 통합 테스트입니다.
 *
 * [검증 범위]
 * 1. 기본 FAQ 목록 조회
 * 2. 관리자 FAQ 등록
 * 3. 관리자 FAQ 수정
 * 4. 관리자 FAQ 삭제
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
@DisplayName("고객센터 FAQ 관리자 흐름 통합 테스트")
class CustomerCenterFaqAdminFlowTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    private static final String ADMIN_EMAIL = "faq-admin@example.com";
    private static final String ADMIN_PASSWORD = "password123";

    @BeforeEach
    void 관리자_준비() throws Exception {
        Map<String, String> registerRequest = Map.of(
                "email", ADMIN_EMAIL,
                "password", ADMIN_PASSWORD,
                "name", "FAQ 관리자"
        );

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(registerRequest)))
                .andExpect(status().isCreated());

        UserEntity adminUser = userRepository.findByEmail(ADMIN_EMAIL).orElseThrow();
        adminUser.updateRole(UserRole.ADMIN);
    }

    @Test
    @DisplayName("관리자는 FAQ를 등록, 수정, 삭제할 수 있어야 한다")
    void 관리자_FAQ_CRUD() throws Exception {
        String adminAccessToken = loginAndGetAccessToken();

        mockMvc.perform(get("/api/support/faqs")
                        .header("Authorization", "Bearer " + adminAccessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data").isArray());

        Map<String, String> createRequest = Map.of(
                "category", "결제",
                "question", "주문 내역은 어디서 확인하나요?",
                "answer", "마이페이지의 구매내역확인 메뉴에서 주문 상태를 확인할 수 있습니다."
        );

        MvcResult createdResult = mockMvc.perform(post("/api/admin/faqs")
                        .header("Authorization", "Bearer " + adminAccessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(createRequest)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.category").value("결제"))
                .andReturn();

        long faqId = objectMapper.readTree(createdResult.getResponse().getContentAsString())
                .path("data")
                .path("id")
                .asLong();

        Map<String, String> updateRequest = Map.of(
                "category", "결제",
                "question", "주문 내역은 어디서 다시 확인하나요?",
                "answer", "마이페이지와 고객센터 안내를 통해 주문 상태를 다시 확인할 수 있습니다."
        );

        mockMvc.perform(patch("/api/admin/faqs/{id}", faqId)
                        .header("Authorization", "Bearer " + adminAccessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updateRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.question").value("주문 내역은 어디서 다시 확인하나요?"));

        mockMvc.perform(delete("/api/admin/faqs/{id}", faqId)
                        .header("Authorization", "Bearer " + adminAccessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }

    private String loginAndGetAccessToken() throws Exception {
        Map<String, String> loginRequest = Map.of(
                "email", ADMIN_EMAIL,
                "password", ADMIN_PASSWORD
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
