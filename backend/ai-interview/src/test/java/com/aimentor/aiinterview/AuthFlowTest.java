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
 * 인증 흐름 통합 테스트
 *
 * [테스트 전략]
 * 실제 HTTP 요청/응답 흐름 전체를 검증합니다.
 * - @SpringBootTest: 전체 애플리케이션 컨텍스트 로드
 * - @AutoConfigureMockMvc: MockMvc 자동 설정
 * - @ActiveProfiles("test"): H2 인메모리 DB 사용 (application-test.yml)
 * - @Transactional: 각 테스트 후 DB 롤백 (테스트 간 격리)
 *
 * [검증 대상 시나리오]
 * 1. 회원가입 → 성공 응답 확인
 * 2. 로그인 → accessToken / refreshToken 발급 확인
 * 3. 내 정보 조회 → JWT 인증 필요 API 동작 확인
 * 4. 인증 없이 보호된 API 접근 → 401 응답 확인
 * 5. 잘못된 이메일/비밀번호 로그인 → 실패 응답 확인
 * 6. 이메일 중복 가입 → 실패 응답 확인
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
@DisplayName("인증 흐름 통합 테스트")
class AuthFlowTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    /** 테스트 전체에서 공용으로 사용하는 테스트 계정 정보 */
    private static final String TEST_EMAIL = "test@example.com";
    private static final String TEST_PASSWORD = "password123";
    private static final String TEST_NAME = "테스트유저";

    /**
     * 각 테스트 실행 전 테스트 사용자를 미리 등록합니다.
     * @Transactional이 각 테스트마다 롤백하므로 격리가 보장됩니다.
     */
    @BeforeEach
    void 테스트_사용자_회원가입() throws Exception {
        Map<String, String> request = Map.of(
                "email", TEST_EMAIL,
                "password", TEST_PASSWORD,
                "name", TEST_NAME
        );

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true));
    }

    // ──────────────────────────────────────────────────────
    // 회원가입
    // ──────────────────────────────────────────────────────

    @Test
    @DisplayName("이메일 중복 가입 시 실패해야 한다")
    void 이메일_중복_가입_실패() throws Exception {
        // BeforeEach에서 이미 TEST_EMAIL로 가입했으므로 같은 이메일로 다시 시도
        Map<String, String> duplicateRequest = Map.of(
                "email", TEST_EMAIL,
                "password", TEST_PASSWORD,
                "name", "다른유저"
        );

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(duplicateRequest)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.error.code").value("DUPLICATE_EMAIL"));
    }

    @Test
    @DisplayName("이메일 형식이 잘못된 경우 회원가입에 실패해야 한다")
    void 잘못된_이메일_형식_가입_실패() throws Exception {
        Map<String, String> invalidRequest = Map.of(
                "email", "not-an-email",
                "password", TEST_PASSWORD,
                "name", TEST_NAME
        );

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(invalidRequest)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));
    }

    // ──────────────────────────────────────────────────────
    // 로그인
    // ──────────────────────────────────────────────────────

    @Test
    @DisplayName("올바른 이메일/비밀번호로 로그인 시 토큰을 발급받아야 한다")
    void 로그인_성공_토큰_발급() throws Exception {
        Map<String, String> loginRequest = Map.of(
                "email", TEST_EMAIL,
                "password", TEST_PASSWORD
        );

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loginRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.data.refreshToken").isNotEmpty());
    }

    @Test
    @DisplayName("잘못된 비밀번호로 로그인 시 실패해야 한다")
    void 잘못된_비밀번호_로그인_실패() throws Exception {
        Map<String, String> loginRequest = Map.of(
                "email", TEST_EMAIL,
                "password", "wrongpassword"
        );

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loginRequest)))
                // 보안상 이메일/비밀번호 불일치를 동일하게 404로 처리 (계정 존재 여부 노출 방지)
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success").value(false));
    }

    // ──────────────────────────────────────────────────────
    // 내 정보 조회 (인증 필요 API)
    // ──────────────────────────────────────────────────────

    @Test
    @DisplayName("JWT 토큰 없이 보호된 API 접근 시 401이 반환되어야 한다")
    void 토큰_없이_인증_필요_API_접근_거부() throws Exception {
        mockMvc.perform(get("/api/auth/me"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("로그인 후 발급받은 토큰으로 내 정보를 조회할 수 있어야 한다")
    void 로그인_후_내정보_조회_성공() throws Exception {
        // 1단계: 로그인하여 accessToken 획득
        String accessToken = 로그인하여_토큰_획득();

        // 2단계: accessToken으로 내 정보 조회
        mockMvc.perform(get("/api/auth/me")
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.email").value(TEST_EMAIL))
                .andExpect(jsonPath("$.data.name").value(TEST_NAME));
    }

    @Test
    @DisplayName("로그인 사용자는 기본 배송정보를 저장하고 다시 조회할 수 있어야 한다")
    void 내정보_수정_성공() throws Exception {
        String accessToken = 로그인하여_토큰_획득();

        Map<String, String> updateRequest = Map.of(
                "name", "배송 정보 저장 사용자",
                "phone", "010-7777-8888",
                "shippingPostalCode", "06236",
                "shippingAddress", "서울시 강남구 테헤란로 321",
                "shippingDetailAddress", "8층 AI 면접팀"
        );

        mockMvc.perform(patch("/api/auth/me")
                        .header("Authorization", "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updateRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.name").value("배송 정보 저장 사용자"))
                .andExpect(jsonPath("$.data.phone").value("010-7777-8888"))
                .andExpect(jsonPath("$.data.shippingPostalCode").value("06236"))
                .andExpect(jsonPath("$.data.shippingAddress").value("서울시 강남구 테헤란로 321"))
                .andExpect(jsonPath("$.data.shippingDetailAddress").value("8층 AI 면접팀"));

        mockMvc.perform(get("/api/auth/me")
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").value("배송 정보 저장 사용자"))
                .andExpect(jsonPath("$.data.shippingPostalCode").value("06236"))
                .andExpect(jsonPath("$.data.shippingAddress").value("서울시 강남구 테헤란로 321"))
                .andExpect(jsonPath("$.data.shippingDetailAddress").value("8층 AI 면접팀"));
    }

    // ──────────────────────────────────────────────────────
    // 헬퍼 메서드
    // ──────────────────────────────────────────────────────

    /**
     * 테스트용 로그인 헬퍼 — accessToken을 문자열로 반환합니다.
     * 로그인이 필요한 다른 테스트 메서드에서 공통으로 사용합니다.
     *
     * @return 발급된 accessToken 문자열
     */
    String 로그인하여_토큰_획득() throws Exception {
        Map<String, String> loginRequest = Map.of(
                "email", TEST_EMAIL,
                "password", TEST_PASSWORD
        );

        MvcResult result = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loginRequest)))
                .andExpect(status().isOk())
                .andReturn();

        String responseBody = result.getResponse().getContentAsString();
        String accessToken = objectMapper.readTree(responseBody)
                .path("data")
                .path("accessToken")
                .asText();

        assertThat(accessToken).isNotBlank();
        return accessToken;
    }
}
