package com.aimentor.external.speech;

import com.aimentor.common.exception.AiServiceException;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.UUID;

/**
 * STT 서비스 Python Whisper 구현체
 *
 * [활성 조건]
 * application.yml의 ai.service.mock=false 일 때 이 빈이 활성화됩니다.
 * mock=true(기본) 이면 MockSpeechService가 대신 활성화됩니다.
 *
 * [동작 방식]
 * 1. MultipartFile로 받은 음성 파일의 바이트를 ByteArrayResource로 변환
 * 2. multipart/form-data 형식으로 Python FastAPI /stt 엔드포인트에 POST 요청
 * 3. Python 서버가 Whisper API를 호출해 변환한 텍스트를 { "text": "..." } 형식으로 반환
 * 4. 변환된 텍스트를 InterviewService로 전달하여 면접 답변 answerText로 저장
 *
 * [에러 처리]
 * RestClientException 발생 시 AiServiceException(ErrorType.SPEECH)으로 변환
 * → GlobalExceptionHandler가 503 SPEECH_SERVER_ERROR로 응답
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = "ai.service.mock", havingValue = "false")
public class PythonSpeechService implements SpeechService {

    /**
     * STT multipart 호출용 HTTP 클라이언트입니다.
     *
     * [왜 필요한가]
     * 질문 생성/TTS와 비슷하게 전송 계층을 직접 제어하기 위해 사용합니다.
     * multipart/form-data 경계(boundary)와 body를 우리가 명시적으로 구성하면
     * Python FastAPI에 실제 파일 파트가 들어가는지 추적하기가 훨씬 쉽습니다.
     */
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .version(HttpClient.Version.HTTP_1_1)
            .build();

    /** application.yml: ai.server.url (예: http://localhost:8000) */
    @Value("${ai.server.url}")
    private String aiServerUrl;

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    /** Python /stt 응답 구조 — { "text": "변환된 텍스트" } */
    private record SttResponse(String text) {}

    /**
     * 음성 파일 → 텍스트 변환 (Whisper STT)
     *
     * [요청 형식]
     * POST {aiServerUrl}/stt
     * Content-Type: multipart/form-data
     * 필드명: "audio" (Python 엔드포인트와 동일해야 함)
     *
     * @param audioFile 면접 답변 음성 파일 (.webm, .mp3, .wav 등)
     * @return Whisper가 변환한 한국어 텍스트
     * @throws AiServiceException Python 서버 호출 실패 또는 빈 응답
     */
    @Override
    public String speechToText(MultipartFile audioFile) {
        String url = aiServerUrl + "/stt";
        log.debug("[PythonSTT] 음성 변환 요청: url={}, 파일크기={}bytes",
                url, audioFile != null ? audioFile.getSize() : 0);

        if (audioFile == null || audioFile.isEmpty()) {
            throw new AiServiceException(AiServiceException.ErrorType.SPEECH,
                    "빈 음성 파일입니다.", null);
        }

        try {
            byte[] bytes = audioFile.getBytes();
            String filename = audioFile.getOriginalFilename() != null
                    ? audioFile.getOriginalFilename()
                    : "audio.webm";
            String contentType = audioFile.getContentType() != null
                    ? audioFile.getContentType()
                    : "audio/webm";

            String boundary = "----AiInterviewBoundary" + UUID.randomUUID().toString().replace("-", "");
            byte[] multipartBody = buildMultipartBody(boundary, filename, contentType, bytes);

            log.debug("[PythonSTT] multipart 전송: filename={}, contentType={}, bodyLength={}",
                    filename, contentType, multipartBody.length);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(30))
                    .header("Content-Type", "multipart/form-data; boundary=" + boundary)
                    .header("Accept", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofByteArray(multipartBody))
                    .build();

            HttpResponse<String> response = httpClient.send(
                    request,
                    HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8)
            );

            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                log.error("[PythonSTT] 응답 오류 — status={}, body={}", response.statusCode(), response.body());
                throw new AiServiceException(AiServiceException.ErrorType.SPEECH,
                        "STT 서버 오류: " + response.body(), null);
            }

            if (response.body() == null || response.body().isBlank()) {
                throw new AiServiceException(AiServiceException.ErrorType.SPEECH,
                        "STT 서버 응답이 비어있습니다.", null);
            }

            SttResponse parsedResponse;
            try {
                parsedResponse = objectMapper.readValue(response.body(), SttResponse.class);
            } catch (JsonProcessingException e) {
                throw new AiServiceException(AiServiceException.ErrorType.SPEECH,
                        "STT 서버 응답 해석 실패: " + e.getMessage(), e);
            }

            if (parsedResponse == null || parsedResponse.text() == null) {
                throw new AiServiceException(AiServiceException.ErrorType.SPEECH,
                        "STT 서버 응답이 비어있습니다.", null);
            }

            log.debug("[PythonSTT] 변환 완료: 텍스트 길이={}", parsedResponse.text().length());
            return parsedResponse.text();

        } catch (IOException e) {
            throw new AiServiceException(AiServiceException.ErrorType.SPEECH,
                    "음성 파일 읽기 실패: " + e.getMessage(), e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new AiServiceException(AiServiceException.ErrorType.SPEECH,
                    "STT 서버 호출이 인터럽트되었습니다.", e);
        } catch (Exception e) {
            log.error("[PythonSTT] 호출 실패: {}", e.getMessage());
            throw new AiServiceException(AiServiceException.ErrorType.SPEECH,
                    "STT 서버 호출 실패: " + e.getMessage(), e);
        }
    }

    /**
     * multipart/form-data 본문을 직접 구성합니다.
     *
     * [형식]
     * --boundary
     * Content-Disposition: form-data; name="audio"; filename="recording.webm"
     * Content-Type: audio/webm
     *
     * <binary bytes>
     * --boundary--
     */
    private byte[] buildMultipartBody(String boundary, String filename, String contentType, byte[] fileBytes) {
        String head = "--" + boundary + "\r\n"
                + "Content-Disposition: form-data; name=\"audio\"; filename=\"" + filename + "\"\r\n"
                + "Content-Type: " + contentType + "\r\n\r\n";
        String tail = "\r\n--" + boundary + "--\r\n";

        byte[] headBytes = head.getBytes(StandardCharsets.UTF_8);
        byte[] tailBytes = tail.getBytes(StandardCharsets.UTF_8);
        byte[] result = new byte[headBytes.length + fileBytes.length + tailBytes.length];

        System.arraycopy(headBytes, 0, result, 0, headBytes.length);
        System.arraycopy(fileBytes, 0, result, headBytes.length, fileBytes.length);
        System.arraycopy(tailBytes, 0, result, headBytes.length + fileBytes.length, tailBytes.length);
        return result;
    }
}
