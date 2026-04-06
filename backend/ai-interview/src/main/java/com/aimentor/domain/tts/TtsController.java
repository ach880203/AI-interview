package com.aimentor.domain.tts;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Map;

/**
 * TTS(텍스트 → 음성) API 컨트롤러
 * 기본 경로: /api/tts
 * 모든 엔드포인트 🔒 JWT 인증 필요
 *
 * [역할]
 * Python AI 서버(8000)의 OpenAI TTS 엔드포인트(/tts/speak)를 프론트엔드에 노출합니다.
 * 프론트엔드는 직접 Python 서버를 호출하지 않고 이 컨트롤러를 통해 요청합니다.
 *
 * [동작 방식]
 * 1. 프론트엔드 → POST /api/tts/speak (text, voice)
 * 2. Spring Boot → POST http://localhost:8000/tts/speak 위임
 * 3. Python이 OpenAI TTS API 호출 → MP3 bytes 반환
 * 4. Spring Boot → 프론트엔드에 audio/mpeg byte[] 전달
 */
@Slf4j
@RestController
@RequestMapping("/api/tts")
@RequiredArgsConstructor
public class TtsController {

    /**
     * TTS JSON 호출용 HTTP 클라이언트입니다.
     *
     * [왜 필요한가]
     * 기존 RestTemplate 경로에서는 Python 로그에
     * `Connection: Upgrade, HTTP2-Settings` 와 함께 body_length=0 이 찍혔습니다.
     * 여기서는 면접 질문 생성과 동일하게 HTTP/1.1로 고정하고,
     * JSON 문자열을 UTF-8 body로 직접 보내 body 누락 가능성을 줄입니다.
     */
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .version(HttpClient.Version.HTTP_1_1)
            .build();

    /** application.yml: ai.server.url (예: http://localhost:8000) */
    @Value("${ai.server.url}")
    private String aiServerUrl;

    private final ObjectMapper objectMapper;

    /**
     * POST /api/tts/speak - 텍스트 → MP3 음성 변환 🔒
     *
     * [요청 본문]
     * { "text": "면접 질문 텍스트", "voice": "nova" }
     *
     * [응답]
     * Content-Type: audio/mpeg
     * Body: MP3 오디오 bytes
     *
     * [에러 처리]
     * Python 서버 호출 실패 시 503 반환 — 프론트엔드가 브라우저 SpeechSynthesis로 자동 폴백합니다.
     *
     * @param body   { text: 변환할 텍스트, voice: 음성 이름(기본값 nova) }
     * @param userDetails 인증된 사용자 정보 (JWT 검증 용도)
     * @return MP3 오디오 bytes (audio/mpeg) 또는 503
     */
    @PostMapping("/speak")
    public ResponseEntity<byte[]> speak(
            @RequestBody Map<String, String> body,
            @AuthenticationPrincipal UserDetails userDetails) {

        String text = body.getOrDefault("text", "").trim();
        String voice = body.getOrDefault("voice", "nova");

        if (text.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        log.debug("[TTS] 음성 변환 요청: user={}, voice={}, textLength={}",
                userDetails.getUsername(), voice, text.length());

        try {
            String url = aiServerUrl + "/tts/speak";
            Map<String, String> pythonRequest = Map.of("text", text, "voice", voice);
            String requestJson = objectMapper.writeValueAsString(pythonRequest);

            log.debug("[TTS] Python 요청 전송: url={}, body={}", url, requestJson);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(20))
                    .header(HttpHeaders.CONTENT_TYPE, "application/json; charset=UTF-8")
                    .header(HttpHeaders.ACCEPT, "audio/mpeg, application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(requestJson, StandardCharsets.UTF_8))
                    .build();

            HttpResponse<byte[]> pythonResponse = httpClient.send(
                    request,
                    HttpResponse.BodyHandlers.ofByteArray()
            );

            if (pythonResponse.statusCode() < 200 || pythonResponse.statusCode() >= 300) {
                log.warn("[TTS] Python AI 서버 응답 오류: status={}, bodyLength={}",
                        pythonResponse.statusCode(),
                        pythonResponse.body() == null ? 0 : pythonResponse.body().length);
                return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).build();
            }

            // 프론트엔드에 audio/mpeg Content-Type 명시 후 전달
            HttpHeaders responseHeaders = new HttpHeaders();
            responseHeaders.setContentType(MediaType.parseMediaType("audio/mpeg"));

            return ResponseEntity.ok()
                    .headers(responseHeaders)
                    .body(pythonResponse.body());

        } catch (JsonProcessingException e) {
            log.warn("[TTS] TTS 요청 직렬화 실패: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).build();
        } catch (Exception e) {
            // Python TTS 서버 오류 — 프론트엔드는 브라우저 SpeechSynthesis로 폴백합니다.
            log.warn("[TTS] Python AI 서버 호출 실패 (브라우저 TTS 폴백 사용): {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).build();
        }
    }
}
