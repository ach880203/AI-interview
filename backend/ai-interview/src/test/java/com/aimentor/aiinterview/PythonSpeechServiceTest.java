package com.aimentor.aiinterview;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
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
 * 음성→텍스트(STT) 변환 엔드포인트 통합 테스트
 *
 * [테스트 전략]
 * MockSpeechService(ai.service.mock=true)를 사용하여
 * Python Whisper 서버 없이 STT 흐름을 검증합니다.
 *
 * [검증 대상 시나리오]
 * 1. 인증 없이 STT 요청 → 401
 * 2. 유효한 음성 파일로 STT 요청 → MockSpeechService가 고정 텍스트 반환
 * 3. STT 결과 텍스트를 면접 답변으로 사용할 수 있는지 확인
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
@DisplayName("STT(음성→텍스트) 엔드포인트 통합 테스트")
class PythonSpeechServiceTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    private static final String TEST_EMAIL = "stt-test@example.com";
    private static final String TEST_PASSWORD = "password123";

    @BeforeEach
    void 테스트_사용자_등록() throws Exception {
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "email", TEST_EMAIL,
                                "password", TEST_PASSWORD,
                                "name", "STT테스트"
                        ))))
                .andExpect(status().isCreated());
    }

    @Test
    @DisplayName("인증 없이 STT 요청 시 401이 반환되어야 한다")
    void 인증없이_STT_요청_거부() throws Exception {
        MockMultipartFile fakeAudio = new MockMultipartFile(
                "audio", "test.webm", "audio/webm", "fake audio bytes".getBytes()
        );

        mockMvc.perform(multipart("/api/interviews/sessions/{id}/speech", 999L)
                        .file(fakeAudio))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("음성 파일로 STT 요청 시 MockSpeechService가 텍스트를 반환해야 한다")
    void 음성파일_STT_변환_성공() throws Exception {
        String token = 로그인하여_토큰_획득();

        // 면접 세션 생성
        long sessionId = 세션_시작하고_세션ID_획득(token);

        // 가상 음성 파일 생성
        MockMultipartFile fakeAudio = new MockMultipartFile(
                "audio", "answer.webm", "audio/webm", "fake audio bytes".getBytes()
        );

        // STT 변환 요청 — MockSpeechService가 고정 텍스트 반환
        mockMvc.perform(multipart("/api/interviews/sessions/{id}/speech", sessionId)
                        .file(fakeAudio)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                // STT 응답은 { "data": { "text": "..." } } 구조입니다.
                // MockSpeechService는 파일명을 포함한 고정 텍스트를 반환합니다.
                .andExpect(jsonPath("$.data.text").isString())
                .andExpect(jsonPath("$.data.text").value(org.hamcrest.Matchers.containsString("answer.webm")));
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
