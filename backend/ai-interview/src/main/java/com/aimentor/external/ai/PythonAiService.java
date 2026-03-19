package com.aimentor.external.ai;

import com.aimentor.common.exception.AiServiceException;
import com.aimentor.external.ai.dto.FeedbackDto;
import com.aimentor.external.ai.dto.GradeResultDto;
import com.aimentor.external.ai.dto.JobPostingScrapedDto;
import com.aimentor.external.ai.dto.ProblemDto;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;

import java.util.ArrayList;
import java.util.List;

/**
 * AI 서비스 Python 연동 구현체
 *
 * [역할]
 * Spring Boot가 Python FastAPI AI 서버와 통신할 때 사용하는 실제 구현입니다.
 * 면접 질문 생성, 면접 피드백 생성, 학습 문제 생성, 학습 채점을 모두 담당합니다.
 *
 * [동작 방식]
 * - 요청 DTO를 Java record로 정의해 Python 스키마와 1:1로 맞춥니다.
 * - RestTemplate으로 JSON POST 요청을 전송합니다.
 * - Python 응답을 내부 DTO로 받은 뒤 서비스 계층이 쓰는 ProblemDto/FeedbackDto 등으로 변환합니다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = "ai.service.mock", havingValue = "false")
public class PythonAiService implements AiService {

    /**
     * JSON API 호출용 HTTP 클라이언트입니다.
     *
     * [왜 별도 클라이언트를 두는가]
     * 면접 질문/피드백/학습 생성 API는 JSON body 전달이 핵심입니다.
     * 실제 장애는 FastAPI에 body가 비어 도착한 문제였기 때문에,
     * 여기서는 HTTP/1.1 + 문자열 body 전송이 명확한 JDK HttpClient를 사용합니다.
     */
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .version(HttpClient.Version.HTTP_1_1)
            .build();

    @Value("${ai.server.url}")
    private String aiServerUrl;

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    /**
     * 대화 한 턴 DTO
     *
     * [역할]
     * 문자열 히스토리를 Python 서버가 기대하는
     * `question`, `answer` 구조 리스트로 바꿀 때 사용합니다.
     */
    private record ConversationTurnDto(
            String question,
            String answer
    ) {
    }

    /**
     * 면접 질문 생성 요청 DTO
     *
     * [주의]
     * conversationHistory 필드명은 Python 스키마와 동일해야 합니다.
     */
    private record InterviewQuestionRequest(
            String resumeContent,
            String coverLetterContent,
            String jobDescription,
            List<ConversationTurnDto> conversationHistory,
            String questionType
    ) {
    }

    /** 면접 질문 생성 응답 DTO */
    private record InterviewQuestionResponse(
            String question,
            String questionType
    ) {
    }

    /** 면접 피드백 생성 요청 DTO */
    private record InterviewFeedbackRequest(
            List<ConversationTurnDto> conversationHistory
    ) {
    }

    /** 면접 피드백 생성 응답 DTO */
    private record InterviewFeedbackResponse(
            int logicScore,
            int relevanceScore,
            int specificityScore,
            int overallScore,
            String weakPoints,
            String improvements,
            String recommendedAnswer
    ) {
    }

    /**
     * 학습 문제 생성 요청 DTO
     *
     * [중요]
     * type을 함께 보내야 객관식/주관식/MIX 요청이 Python 서버까지 정확히 전달됩니다.
     */
    private record LearningProblemsRequest(
            String subject,
            String difficulty,
            int count,
            String type,
            Integer userAccuracy
    ) {
    }

    /**
     * 학습 문제 생성 응답 DTO
     *
     * [역할]
     * Python 서버가 반환한 `type`, `choices`, `answer` 필드를 그대로 받습니다.
     */
    private record LearningProblemsResponse(List<ProblemItem> problems) {
        private record ProblemItem(
                String type,
                String question,
                List<String> choices,
                String answer,
                String explanation
        ) {
        }
    }

    /** 문서 텍스트 추출 응답 DTO */
    private record DocumentExtractResponse(String extractedText) {}

    /** 채용공고 스크래핑 요청 DTO — Python ScrapeJobPostingRequest와 동일 구조 */
    private record ScrapeJobPostingRequest(String url) {}

    /** 채용공고 스크래핑 응답 DTO — Python JobPostingScrapedResponse와 동일 구조 */
    private record ScrapeJobPostingResponse(
            String company,
            String position,
            String description
    ) {}

    /** 학습 채점 요청 DTO */
    private record LearningGradeRequest(
            String question,
            String correctAnswer,
            String userAnswer,
            String explanation
    ) {
    }

    /** 학습 채점 응답 DTO */
    private record LearningGradeResponse(
            boolean isCorrect,
            String aiFeedback
    ) {
    }

    /**
     * 면접 질문 생성
     *
     * [동작 방식]
     * 문자열 히스토리를 대화 목록으로 변환한 뒤 Python `/interview/question`에 전달합니다.
     */
    @Override
    public String generateInterviewQuestion(String resumeContent, String coverLetterContent,
                                            String jobDescription, String history, String questionType) {
        String url = aiServerUrl + "/interview/question";
        log.debug("[Python AI] 면접 질문 생성 요청: url={}, questionType={}", url, questionType);

        try {
            InterviewQuestionRequest request = new InterviewQuestionRequest(
                    resumeContent,
                    coverLetterContent,
                    jobDescription,
                    parseHistoryToTurns(history),
                    questionType
            );

            InterviewQuestionResponse response = post(url, request, InterviewQuestionResponse.class);
            return response.question();
        } catch (RestClientException exception) {
            log.error("[Python AI] 면접 질문 생성 실패", exception);
            throw new AiServiceException("AI 서버 면접 질문 생성 실패: " + exception.getMessage(), exception);
        }
    }

    /**
     * 면접 피드백 생성
     *
     * [동작 방식]
     * 전체 Q/A 히스토리를 Python `/interview/feedback`에 전달하고
     * 받은 응답을 FeedbackDto로 변환합니다.
     */
    @Override
    public FeedbackDto generateFeedback(String history) {
        String url = aiServerUrl + "/interview/feedback";
        log.debug("[Python AI] 면접 피드백 생성 요청: url={}", url);

        try {
            InterviewFeedbackRequest request = new InterviewFeedbackRequest(parseHistoryToTurns(history));
            InterviewFeedbackResponse response = post(url, request, InterviewFeedbackResponse.class);

            return new FeedbackDto(
                    response.logicScore(),
                    response.relevanceScore(),
                    response.specificityScore(),
                    response.overallScore(),
                    response.weakPoints(),
                    response.improvements(),
                    response.recommendedAnswer()
            );
        } catch (RestClientException exception) {
            log.error("[Python AI] 면접 피드백 생성 실패", exception);
            throw new AiServiceException("AI 서버 면접 피드백 생성 실패: " + exception.getMessage(), exception);
        }
    }

    /**
     * 학습 문제 생성
     *
     * [역할]
     * 문제 유형(type)을 포함한 요청을 Python `/learning/generate`에 전달합니다.
     *
     * [왜 수정했는가]
     * 기존에는 type을 인터페이스에서 받지 않아 항상 MIX처럼 동작했고,
     * 객관식 선택지가 누락되어 프론트엔드가 문제를 풀 수 없는 경우가 있었습니다.
     */
    @Override
    public List<ProblemDto> generateLearningProblems(String subject, String difficulty, int count, String type, Integer userAccuracy) {
        String url = aiServerUrl + "/learning/generate";
        log.debug("[Python AI] 학습 문제 생성 요청: subject={}, difficulty={}, count={}, type={}, userAccuracy={}",
                subject, difficulty, count, type, userAccuracy);

        try {
            LearningProblemsRequest request = new LearningProblemsRequest(subject, difficulty, count, type, userAccuracy);
            LearningProblemsResponse response = post(url, request, LearningProblemsResponse.class);

            return response.problems().stream()
                    .map(problem -> new ProblemDto(
                            problem.question(),
                            problem.answer(),
                            problem.explanation(),
                            difficulty,
                            problem.choices(),
                            problem.type()
                    ))
                    .toList();
        } catch (RestClientException exception) {
            log.error("[Python AI] 학습 문제 생성 실패", exception);
            throw new AiServiceException("AI 서버 학습 문제 생성 실패: " + exception.getMessage(), exception);
        }
    }

    /**
     * 학습 답안 채점
     *
     * [동작 방식]
     * Python `/learning/grade` 응답은 `isCorrect`, `aiFeedback` 위주이므로
     * 점수는 0으로 채워 GradeResultDto 형태에 맞춰 반환합니다.
     */
    /**
     * 학습 답안 채점
     *
     * [동작 방식]
     * Python `/learning/grade` 엔드포인트에 문제, 정답, 사용자 답변, 해설을 전달합니다.
     * explanation이 있으면 AI가 더 정확한 피드백을 생성할 수 있습니다.
     */
    @Override
    public GradeResultDto gradeLearningAnswer(String question, String correctAnswer, String userAnswer, String explanation) {
        String url = aiServerUrl + "/learning/grade";
        log.debug("[Python AI] 학습 답안 채점 요청: question={}", question);

        try {
            LearningGradeRequest request = new LearningGradeRequest(
                    question,
                    correctAnswer,
                    userAnswer,
                    explanation != null ? explanation : ""
            );

            LearningGradeResponse response = post(url, request, LearningGradeResponse.class);
            return new GradeResultDto(
                    response.isCorrect(),
                    0,
                    response.aiFeedback(),
                    correctAnswer
            );
        } catch (RestClientException exception) {
            log.error("[Python AI] 학습 답안 채점 실패", exception);
            throw new AiServiceException("AI 서버 학습 답안 채점 실패: " + exception.getMessage(), exception);
        }
    }

    /**
     * PDF/이미지 파일 텍스트 추출
     *
     * [동작 방식]
     * Python /extract/document 에 파일을 multipart로 전달합니다.
     * PDF는 pypdf, 이미지는 GPT-4o Vision으로 텍스트를 추출합니다.
     */
    @Override
    public String extractDocumentText(String filename, byte[] fileBytes, String contentType) {
        String url = aiServerUrl + "/extract/document";
        log.debug("[Python AI] 문서 텍스트 추출 요청: filename={}, size={}", filename, fileBytes.length);

        try {
            ByteArrayResource resource = new ByteArrayResource(fileBytes) {
                @Override
                public String getFilename() {
                    return filename;
                }
            };

            HttpHeaders fileHeaders = new HttpHeaders();
            fileHeaders.setContentType(MediaType.parseMediaType(contentType));

            MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
            body.add("file", new HttpEntity<>(resource, fileHeaders));

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.MULTIPART_FORM_DATA);

            HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(body, headers);
            DocumentExtractResponse response = restTemplate.postForObject(url, requestEntity, DocumentExtractResponse.class);

            if (response == null || response.extractedText() == null) {
                throw new AiServiceException("AI 서버 문서 추출 응답이 비어있습니다.", null);
            }
            return response.extractedText();
        } catch (RestClientException e) {
            log.error("[Python AI] 문서 텍스트 추출 실패", e);
            throw new AiServiceException("AI 서버 문서 추출 실패: " + e.getMessage(), e);
        }
    }

    /**
     * 채용공고 URL 스크래핑
     *
     * [동작 방식]
     * Python /scrape/job-posting 에 URL을 전달하면
     * Python이 HTML을 가져와 GPT로 company/position/description을 추출해 반환합니다.
     */
    @Override
    public JobPostingScrapedDto scrapeJobPosting(String url) {
        String endpoint = aiServerUrl + "/scrape/job-posting";
        log.debug("[Python AI] 채용공고 스크래핑 요청: url={}", url);

        try {
            ScrapeJobPostingRequest request = new ScrapeJobPostingRequest(url);
            ScrapeJobPostingResponse response = post(endpoint, request, ScrapeJobPostingResponse.class);
            return new JobPostingScrapedDto(response.company(), response.position(), response.description());
        } catch (RestClientException exception) {
            log.error("[Python AI] 채용공고 스크래핑 실패", exception);
            throw new AiServiceException("AI 서버 채용공고 스크래핑 실패: " + exception.getMessage(), exception);
        }
    }

    /**
     * 공용 POST 호출 헬퍼
     *
     * [왜 JDK HttpClient를 사용하는가]
     * FastAPI 쪽 422 로그를 보면 request body 자체가 비어 도착하는 경우가 있었습니다.
     * 이 메서드는 JSON 문자열을 UTF-8 body로 직접 전송하여
     * "직렬화는 됐지만 body가 비는" 문제를 차단합니다.
     *
     * [주의]
     * JSON 문자열은 ObjectMapper로 먼저 직렬화해서 로그와 실제 전송 payload가
     * 완전히 동일하도록 유지합니다.
     */
    private <RequestType, ResponseType> ResponseType post(
            String url,
            RequestType body,
            Class<ResponseType> responseType
    ) {
        String json;
        try {
            json = objectMapper.writeValueAsString(body);
            log.debug("[Python AI] 요청 전송 — url={}, body={}", url, json);
        } catch (JsonProcessingException e) {
            throw new AiServiceException("요청 직렬화 실패: " + e.getMessage(), e);
        }

        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(120))
                    .header(HttpHeaders.CONTENT_TYPE, "application/json; charset=UTF-8")
                    .header(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE)
                    .POST(HttpRequest.BodyPublishers.ofString(json, StandardCharsets.UTF_8))
                    .build();

            HttpResponse<String> response = httpClient.send(
                    request,
                    HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8)
            );

            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                log.error("[Python AI] 응답 오류 — status={}, body={}",
                        response.statusCode(), response.body());
                throw new AiServiceException(
                        "AI 서버 HTTP 오류: " + response.statusCode() + " / body=" + response.body(),
                        null
                );
            }

            if (response.body() == null || response.body().isBlank()) {
                throw new AiServiceException("AI 서버 응답 본문이 비어있습니다.", null);
            }

            return objectMapper.readValue(response.body(), responseType);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new AiServiceException("AI 서버 호출이 인터럽트되었습니다.", e);
        } catch (JsonProcessingException e) {
            throw new AiServiceException("AI 서버 응답 역직렬화 실패: " + e.getMessage(), e);
        } catch (Exception e) {
            throw new AiServiceException("AI 서버 호출 실패: " + e.getMessage(), e);
        }
    }

    /**
     * 문자열 히스토리를 대화 목록으로 변환합니다.
     *
     * [입력 예시]
     * Q1: 자기소개를 해주세요.
     * A1: 저는 ...
     * Q2: 가장 자신 있는 기술은?
     * A2: Spring Boot입니다.
     *
     * [동작 방식]
     * Q 줄을 임시 저장했다가 다음 A 줄이 나오면 한 쌍으로 묶어 리스트에 추가합니다.
     */
    private List<ConversationTurnDto> parseHistoryToTurns(String history) {
        if (history == null || history.isBlank() || history.contains("없음")) {
            return List.of();
        }

        List<ConversationTurnDto> turns = new ArrayList<>();
        String currentQuestion = null;

        for (String line : history.split("\n")) {
            if (line.matches("^Q\\d+: .*")) {
                currentQuestion = line.replaceFirst("^Q\\d+: ", "").trim();
                continue;
            }

            if (line.matches("^A\\d+: .*") && currentQuestion != null) {
                String answer = line.replaceFirst("^A\\d+: ", "").trim();
                turns.add(new ConversationTurnDto(currentQuestion, answer));
                currentQuestion = null;
            }
        }

        return turns;
    }
}
