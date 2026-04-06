package com.aimentor.domain.interview;

import com.aimentor.common.ApiResponse;
import com.aimentor.domain.interview.dto.*;
import com.aimentor.external.ai.AiService;
import com.aimentor.external.ai.dto.DailyPracticeResultDto;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

/**
 * 면접 API 컨트롤러
 * 기본 경로: /api/interviews
 * 모든 엔드포인트 🔒 JWT 인증 필요
 *
 * 면접 진행 순서:
 * 1. POST /sessions              → 세션 시작 + 첫 질문 수신
 * 2. POST /sessions/{id}/speech  → 음성 파일 → 텍스트 변환 (Whisper STT)
 * 3. POST /sessions/{id}/answer  → 답변 제출 + 다음 질문 수신 (반복)
 * 4. POST /sessions/{id}/end     → 면접 종료 + 피드백 수신
 * 5. GET  /sessions/{id}/feedback → 피드백 재조회
 */
@RestController
@RequestMapping("/api/interviews")
@RequiredArgsConstructor
public class InterviewController {

    private final InterviewService interviewService;
    private final AiService aiService;

    /**
     * POST /api/interviews/sessions - 면접 세션 시작 🔒
     * 응답: 세션 정보 + 첫 번째 질문
     */
    @PostMapping("/sessions")
    public ResponseEntity<ApiResponse<SessionStartResponseDto>> startSession(
            @RequestBody SessionStartRequestDto request,
            @AuthenticationPrincipal UserDetails userDetails) {

        SessionStartResponseDto response = interviewService.startSession(
                userDetails.getUsername(), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(response));
    }

    /**
     * GET /api/interviews/qa-history - 오답노트용 면접 Q&A 전체 이력 🔒
     * 완료된 세션의 Q&A를 최신순으로 반환합니다.
     */
    @GetMapping("/qa-history")
    public ResponseEntity<ApiResponse<List<InterviewQaReviewDto>>> getQaHistory(
            @AuthenticationPrincipal UserDetails userDetails) {

        return ResponseEntity.ok(ApiResponse.success(
                interviewService.getQaHistory(userDetails.getUsername())));
    }

    /**
     * GET /api/interviews/sessions - 내 면접 세션 목록 🔒
     * 응답: 세션 요약 목록 (Q&A 미포함)
     */
    @GetMapping("/sessions")
    public ResponseEntity<ApiResponse<List<SessionSummaryResponseDto>>> getSessions(
            @AuthenticationPrincipal UserDetails userDetails) {

        return ResponseEntity.ok(ApiResponse.success(
                interviewService.getSessions(userDetails.getUsername())));
    }

    /**
     * GET /api/interviews/sessions/{id} - 세션 상세 + Q&A 전체 🔒
     * 응답: 세션 정보 + 전체 Q&A 목록 (orderNum 순)
     */
    @GetMapping("/sessions/{id}")
    public ResponseEntity<ApiResponse<SessionDetailResponseDto>> getSessionDetail(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails userDetails) {

        return ResponseEntity.ok(ApiResponse.success(
                interviewService.getSessionDetail(id, userDetails.getUsername())));
    }

    /**
     * POST /api/interviews/sessions/{id}/speech - 음성 파일 → 텍스트 변환 (Whisper STT) 🔒
     * 요청: multipart/form-data, 필드명 "audio"
     * 응답: { "text": "변환된 텍스트" }
     * 실패 시 503 SPEECH_SERVER_ERROR
     */
    @PostMapping("/sessions/{id}/speech")
    public ResponseEntity<ApiResponse<Map<String, String>>> convertSpeech(
            @PathVariable Long id,
            @RequestParam("audio") MultipartFile audioFile,
            @AuthenticationPrincipal UserDetails userDetails) {

        String text = interviewService.convertSpeech(id, userDetails.getUsername(), audioFile);
        return ResponseEntity.ok(ApiResponse.success(Map.of("text", text)));
    }

    /**
     * POST /api/interviews/sessions/{id}/answer - 답변 제출 🔒
     * 요청: { "orderNum": 1, "answerText": "...", "audioUrl": null }
     * 응답: { "hasNextQuestion": true, "nextQuestion": {...} }
     *        또는 { "hasNextQuestion": false, "nextQuestion": null }
     */
    @PostMapping("/sessions/{id}/answer")
    public ResponseEntity<ApiResponse<AnswerResponseDto>> submitAnswer(
            @PathVariable Long id,
            @Valid @RequestBody AnswerSubmitRequestDto request,
            @AuthenticationPrincipal UserDetails userDetails) {

        return ResponseEntity.ok(ApiResponse.success(
                interviewService.submitAnswer(id, request, userDetails.getUsername())));
    }

    /**
     * POST /api/interviews/sessions/{id}/end - 면접 종료 🔒
     * 세션 COMPLETED 처리 + Mock 피드백 즉시 생성 반환
     * 응답: 피드백 전체 내용
     */
    @PostMapping("/sessions/{id}/end")
    public ResponseEntity<ApiResponse<FeedbackResponseDto>> endSession(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails userDetails) {

        return ResponseEntity.ok(ApiResponse.success(
                interviewService.endSession(id, userDetails.getUsername())));
    }

    /**
     * GET /api/interviews/growth - 면접 회차별 성장 추적 🔒
     * 완료된 세션 전체의 점수를 시간 오름차순으로 반환합니다.
     * 단일 쿼리로 차트 데이터를 제공하여 N+1 문제를 방지합니다.
     */
    @GetMapping("/growth")
    public ResponseEntity<ApiResponse<GrowthReportDto>> getGrowthReport(
            @AuthenticationPrincipal UserDetails userDetails) {

        return ResponseEntity.ok(ApiResponse.success(
                interviewService.getGrowthReport(userDetails.getUsername())));
    }

    /**
     * POST /api/interviews/daily-practice - 오늘의 연습질문 답변 평가 🔒
     * 요청: { "question": "...", "answer": "..." }
     * 응답: { "score": 75, "feedback": "..." }
     */
    @PostMapping("/daily-practice")
    public ResponseEntity<ApiResponse<DailyPracticeResultDto>> evaluateDailyPractice(
            @RequestBody Map<String, String> body,
            @AuthenticationPrincipal UserDetails userDetails) {

        DailyPracticeResultDto result = aiService.evaluateDailyPractice(
                body.get("question"), body.get("answer"));
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    /**
     * GET /api/interviews/sessions/{id}/feedback - 피드백 조회 🔒
     * 면접 종료 후에만 조회 가능 (종료 전: 404)
     */
    @GetMapping("/sessions/{id}/feedback")
    public ResponseEntity<ApiResponse<FeedbackResponseDto>> getFeedback(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails userDetails) {

        return ResponseEntity.ok(ApiResponse.success(
                interviewService.getFeedback(id, userDetails.getUsername())));
    }
}
