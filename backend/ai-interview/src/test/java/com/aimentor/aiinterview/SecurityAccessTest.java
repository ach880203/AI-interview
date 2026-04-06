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
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 보안 접근 제어 통합 테스트
 *
 * [테스트 전략]
 * Spring Security 설정이 실제 HTTP 요청에 올바르게 적용되는지 검증합니다.
 *
 * [검증 대상 시나리오]
 * 1. 공개 API(도서 목록, 학습 과목) → 인증 없이 접근 가능
 * 2. 보호된 API → 토큰 없이 401 반환
 * 3. ADMIN 전용 API → 일반 사용자가 접근 시 403 반환
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
@DisplayName("보안 접근 제어 통합 테스트")
class SecurityAccessTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    private static final String USER_EMAIL = "security-test@example.com";
    private static final String USER_PASSWORD = "password123";

    @BeforeEach
    void 테스트_사용자_등록() throws Exception {
        Map<String, Object> request = Map.of(
                "email", USER_EMAIL,
                "password", USER_PASSWORD,
                "name", "보안테스트"
        );

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated());
    }

    // ──────────────────────────────────────────────────────
    // 공개 API — 인증 불필요
    // ──────────────────────────────────────────────────────

    @Test
    @DisplayName("도서 목록 조회는 인증 없이 가능해야 한다")
    void 공개_도서_목록_조회() throws Exception {
        mockMvc.perform(get("/api/books"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }

    @Test
    @DisplayName("학습 과목 목록 조회는 인증 없이 가능해야 한다")
    void 공개_학습_과목_조회() throws Exception {
        mockMvc.perform(get("/api/learning/subjects"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }

    // ──────────────────────────────────────────────────────
    // 보호된 API — 인증 필요
    // ──────────────────────────────────────────────────────

    @Test
    @DisplayName("내 정보 조회는 토큰 없이 401이 반환되어야 한다")
    void 보호된_내정보_조회_인증없음() throws Exception {
        mockMvc.perform(get("/api/auth/me"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("주문 목록 조회는 토큰 없이 401이 반환되어야 한다")
    void 보호된_주문목록_인증없음() throws Exception {
        mockMvc.perform(get("/api/orders"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("면접 세션 목록 조회는 토큰 없이 401이 반환되어야 한다")
    void 보호된_면접세션목록_인증없음() throws Exception {
        mockMvc.perform(get("/api/interviews/sessions"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("학습 통계 조회는 토큰 없이 401이 반환되어야 한다")
    void 보호된_학습통계_인증없음() throws Exception {
        mockMvc.perform(get("/api/learning/stats"))
                .andExpect(status().isUnauthorized());
    }

    // ──────────────────────────────────────────────────────
    // ADMIN 전용 API — 일반 사용자 접근 차단
    // ──────────────────────────────────────────────────────

    @Test
    @DisplayName("일반 사용자가 ADMIN 대시보드에 접근하면 403이 반환되어야 한다")
    void 일반사용자_관리자_대시보드_접근_거부() throws Exception {
        String token = 로그인하여_토큰_획득();

        mockMvc.perform(get("/api/admin/dashboard")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("일반 사용자가 도서 등록(ADMIN 전용)에 접근하면 403이 반환되어야 한다")
    void 일반사용자_도서등록_접근_거부() throws Exception {
        String token = 로그인하여_토큰_획득();

        Map<String, Object> bookRequest = Map.of(
                "title", "테스트 도서",
                "author", "테스트 저자",
                "publisher", "테스트 출판사",
                "price", 10000,
                "stock", 5
        );

        mockMvc.perform(post("/api/books")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(bookRequest)))
                .andExpect(status().isForbidden());
    }

    // ──────────────────────────────────────────────────────
    // 헬퍼 메서드
    // ──────────────────────────────────────────────────────

    String 로그인하여_토큰_획득() throws Exception {
        Map<String, Object> loginRequest = Map.of(
                "email", USER_EMAIL,
                "password", USER_PASSWORD
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
}
