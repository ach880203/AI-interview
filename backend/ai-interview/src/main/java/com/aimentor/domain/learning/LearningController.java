package com.aimentor.domain.learning;

import com.aimentor.common.ApiResponse;
import com.aimentor.domain.learning.dto.*;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 학습 기능 전용 API 컨트롤러입니다.
 *
 * [역할]
 * 학습 과목 조회, 문제 생성, 답안 채점, 학습 통계 조회 요청을 받아
 * HTTP 요청과 서비스 계층을 연결하는 진입점 역할을 합니다.
 *
 * [동작 방식]
 * 컨트롤러는 요청 검증과 인증 사용자 전달에 집중하고,
 * 실제 문제 생성, 채점, 통계 계산은 모두 LearningService에 위임합니다.
 */
@RestController
@RequestMapping("/api/learning")
@RequiredArgsConstructor
public class LearningController {

    private final LearningService learningService;

    /**
     * 학습 과목 목록을 조회합니다.
     *
     * [동작 방식]
     * 별도 입력값 없이 등록된 과목 전체를 읽어 와서
     * 프론트 학습 시작 화면에서 그대로 사용할 수 있는 형태로 반환합니다.
     *
     * @return 학습 과목 목록 응답
     */
    @GetMapping("/subjects")
    public ResponseEntity<ApiResponse<List<LearningSubjectResponseDto>>> getSubjects() {
        return ResponseEntity.ok(ApiResponse.success(learningService.getSubjects()));
    }

    /**
     * 선택한 과목 기준으로 AI 학습 문제를 생성합니다.
     *
     * [동작 방식]
     * 1. 경로 변수로 과목 ID를 받습니다.
     * 2. 본문으로 난이도, 문제 수, 문제 유형을 받습니다.
     * 3. 서비스가 생성한 문제 목록을 공통 응답 형식으로 감싸 반환합니다.
     *
     * @param id 과목 ID
     * @param request 문제 생성 요청 정보
     * @return 생성된 문제 목록 응답
     */
    @PostMapping("/subjects/{id}/problems/generate")
    public ResponseEntity<ApiResponse<List<LearningProblemDto>>> generateProblems(
            @PathVariable Long id,
            @Valid @RequestBody LearningGenerateRequestDto request,
            @AuthenticationPrincipal UserDetails userDetails) {

        return ResponseEntity.ok(ApiResponse.success(
                learningService.generateProblems(id, request, userDetails.getUsername())
        ));
    }

    /**
     * 사용자가 제출한 답안을 채점하고 학습 시도로 저장합니다.
     *
     * [동작 방식]
     * 1. 인증된 사용자 정보를 받아 사용자별 학습 기록으로 저장합니다.
     * 2. 답안 채점 결과를 반환합니다.
     * 3. 저장된 기록은 이후 학습 통계 API에서 집계에 사용됩니다.
     *
     * @param request 답안 제출 정보
     * @param userDetails 현재 로그인한 사용자 정보
     * @return 채점 결과 응답
     */
    @PostMapping("/attempts")
    public ResponseEntity<ApiResponse<LearningAttemptResponseDto>> submitAttempt(
            @Valid @RequestBody LearningAttemptRequestDto request,
            @AuthenticationPrincipal UserDetails userDetails) {

        return ResponseEntity.ok(ApiResponse.success(
                learningService.gradeAttempt(request, userDetails.getUsername())
        ));
    }

    /**
     * 로그인한 사용자의 오답 목록을 조회합니다.
     *
     * [동작 방식]
     * isCorrect=false로 저장된 학습 시도를 최신순으로 반환합니다.
     * 프론트엔드 오답노트 화면에서 사용합니다.
     *
     * @param userDetails 현재 로그인한 사용자 정보
     * @return 오답 목록 응답
     */
    /**
     * 같은 학습 세션 키로 저장된 결과를 다시 조회합니다.
     *
     * [사용 이유]
     * 학습 결과 화면은 현재 같은 라우트 안에서 렌더링되기 때문에
     * 새로고침이 일어나면 프런트 state가 사라질 수 있습니다.
     * 이 API는 그때 부분 완료 결과나 전체 완료 결과를 백엔드 저장값으로 복원합니다.
     */
    @GetMapping("/sessions/{sessionKey}")
    public ResponseEntity<ApiResponse<LearningSessionResultResponseDto>> getSessionResult(
            @PathVariable String sessionKey,
            @AuthenticationPrincipal UserDetails userDetails) {

        return ResponseEntity.ok(ApiResponse.success(
                learningService.getSessionResult(sessionKey, userDetails.getUsername())
        ));
    }

    @GetMapping("/attempts/wrong")
    public ResponseEntity<ApiResponse<List<WrongLearningAttemptDto>>> getWrongAttempts(
            @AuthenticationPrincipal UserDetails userDetails) {

        return ResponseEntity.ok(ApiResponse.success(
                learningService.getWrongAttempts(userDetails.getUsername())
        ));
    }

    /**
     * 로그인한 사용자의 카테고리별 학습 약점을 분석합니다.
     *
     * [동작 방식]
     * 과목이 지정된 학습 시도를 집계하여 정답률 오름차순으로 반환합니다.
     * isWeak=true 항목은 정답률 < 60% 이고 시도 횟수 >= 3인 약점 과목입니다.
     *
     * @param userDetails 현재 로그인한 사용자 정보
     * @return 카테고리별 분석 결과
     */
    @GetMapping("/analytics")
    public ResponseEntity<ApiResponse<LearningAnalyticsResponseDto>> getAnalytics(
            @AuthenticationPrincipal UserDetails userDetails) {

        return ResponseEntity.ok(ApiResponse.success(
                learningService.getAnalytics(userDetails.getUsername())
        ));
    }

    /**
     * 로그인한 사용자에게 맞춤 학습 과목을 추천합니다.
     *
     * [동작 방식]
     * 약점 과목이 있으면 가장 정답률이 낮은 과목을 추천합니다.
     * 약점이 없으면 시도 횟수가 가장 적은 과목을 추천합니다.
     *
     * @param userDetails 현재 로그인한 사용자 정보
     * @return 추천 과목 정보 (등록된 과목이 없으면 null)
     */
    @GetMapping("/recommendations")
    public ResponseEntity<ApiResponse<LearningRecommendationDto>> getRecommendation(
            @AuthenticationPrincipal UserDetails userDetails) {

        return ResponseEntity.ok(ApiResponse.success(
                learningService.getRecommendation(userDetails.getUsername())
        ));
    }

    /**
     * 로그인한 사용자의 학습 통계를 조회합니다.
     *
     * [동작 방식]
     * 저장된 학습 시도 기록을 기준으로 총 시도 수, 정답 수, 정답률,
     * 과목별 통계, 최근 시도 목록을 함께 계산해서 반환합니다.
     *
     * @param userDetails 현재 로그인한 사용자 정보
     * @return 학습 통계 응답
     */
    @GetMapping("/stats")
    public ResponseEntity<ApiResponse<LearningStatsResponseDto>> getStats(
            @AuthenticationPrincipal UserDetails userDetails) {

        return ResponseEntity.ok(ApiResponse.success(
                learningService.getStats(userDetails.getUsername())
        ));
    }
}
