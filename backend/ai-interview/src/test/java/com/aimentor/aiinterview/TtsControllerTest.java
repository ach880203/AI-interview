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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * TTS 컨트롤러 통합 테스트
 *
 * [테스트 전략]
 * Python AI 서버 없이 TTS 엔드포인트의 보안 및 입력 검증만 검증합니다.
 * (실제 음성 변환은 Python 서버가 필요하므로 503 응답도 허용합니다.)
 *
 * [검증 대상 시나리오]
 * 1. 인증 없이 TTS 요청 → 401 반환
 * 2. 빈 텍스트로 TTS 요청 → 400 반환
 * 3. 유효한 텍스트로 TTS 요청 → Python 미연결 시 503 허용 (컨트롤러 진입 확인)
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
@DisplayName("TTS 컨트롤러 통합 테스트")
class TtsControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    private static final String TEST_EMAIL = "tts-test@example.com";
    private static final String TEST_PASSWORD = "password123";

    @BeforeEach
    void 테스트_사용자_등록() throws Exception {
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "email", TEST_EMAIL,
                                "password", TEST_PASSWORD,
                                "name", "TTS테스트"
                        ))))
                .andExpect(status().isCreated());
    }

    @Test
    @DisplayName("인증 없이 TTS 요청 시 401이 반환되어야 한다")
    void 인증없이_TTS_요청_거부() throws Exception {
        mockMvc.perform(post("/api/tts/speak")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("text", "안녕하세요"))))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("빈 텍스트로 TTS 요청 시 400이 반환되어야 한다")
    void 빈_텍스트_TTS_요청_거부() throws Exception {
        String token = 로그인하여_토큰_획득();

        mockMvc.perform(post("/api/tts/speak")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("text", "   "))))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("유효한 텍스트로 TTS 요청 시 컨트롤러가 처리해야 한다 (Python 미연결 시 503 허용)")
    void 유효한_텍스트_TTS_요청_처리() throws Exception {
        String token = 로그인하여_토큰_획득();

        mockMvc.perform(post("/api/tts/speak")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "text", "안녕하세요. 면접 질문을 시작하겠습니다.",
                                "voice", "nova"
                        ))))
                // Python AI 서버가 없으면 503, 있으면 200
                .andExpect(result -> {
                    int status = result.getResponse().getStatus();
                    assertThat(status).isIn(200, 503);
                });
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
}
