package com.aimentor.domain.learning;

import com.aimentor.common.BusinessException;
import com.aimentor.common.ErrorCode;
import com.aimentor.domain.learning.dto.*;
import com.aimentor.domain.subscription.UsageLimitService;
import com.aimentor.domain.user.UserEntity;
import com.aimentor.domain.user.UserRepository;
import com.aimentor.external.ai.AiService;
import com.aimentor.external.ai.dto.GradeResultDto;
import com.aimentor.external.ai.dto.ProblemDto;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * 학습 기능의 핵심 비즈니스 로직을 담당하는 서비스 클래스입니다.
 *
 * [역할]
 * 학습 과목 조회, 문제 생성, 답안 채점, 학습 시도 저장, 학습 통계 집계를 처리합니다.
 *
 * [동작 방식]
 * - 문제 생성과 채점은 AiService에 위임합니다.
 * - 사용자별 학습 기록은 LearningAttemptEntity로 저장합니다.
 * - 대시보드와 학습 통계 화면에서 사용할 값은 저장된 기록을 기준으로 계산합니다.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class LearningService {

    private final LearningRepository learningRepository;
    private final LearningAttemptRepository learningAttemptRepository;
    private final UserRepository userRepository;
    private final AiService aiService;
    private final UsageLimitService usageLimitService;

    /**
     * 등록된 학습 과목 목록을 조회합니다.
     *
     * [동작 방식]
     * 엔티티를 DTO로 변환하여 반환합니다.
     * 엔티티 직접 노출을 방지하여 API 응답이 내부 구조 변경에 영향받지 않도록 합니다.
     *
     * @return 학습 과목 응답 DTO 목록
     */
    public List<LearningSubjectResponseDto> getSubjects() {
        return learningRepository.findAll().stream()
                .map(LearningSubjectResponseDto::from)
                .toList();
    }

    /**
     * 선택한 과목 기준으로 학습 문제를 생성합니다.
     *
     * [동작 방식]
     * 1. 과목 ID가 실제로 존재하는지 확인합니다.
     * 2. AI 서비스에 과목명, 난이도, 문제 수, 문제 유형을 전달합니다.
     * 3. AI 응답을 프론트에서 바로 사용할 DTO로 변환합니다.
     *
     * @param subjectId 과목 ID
     * @param request 문제 생성 요청 정보
     * @return 생성된 문제 목록
     */
    @Transactional
    public List<LearningProblemDto> generateProblems(Long subjectId, LearningGenerateRequestDto request, String email) {
        UserEntity user = getUser(email);
        usageLimitService.checkLearningUsage(user.getId(), request.sessionKey());
        LearningSubjectEntity subject = getSubject(subjectId);

        List<ProblemDto> problems = aiService.generateLearningProblems(
                subject.getName(),
                request.difficulty(),
                request.count(),
                request.type(),
                request.userAccuracy()
        );

        return problems.stream()
                .map(problem -> {
                    String resolvedType = problem.type() != null
                            ? problem.type()
                            : ("MIX".equals(request.type()) ? "SHORT" : request.type());

                    return new LearningProblemDto(
                            resolvedType,
                            problem.question(),
                            problem.choices(),
                            problem.correctAnswer(),
                            problem.explanation()
                    );
                })
                .toList();
    }

    /**
     * 사용자의 답안을 채점하고 학습 시도로 저장합니다.
     *
     * [동작 방식]
     * 1. 현재 로그인한 사용자를 조회합니다.
     * 2. AI 서비스로 답안을 채점합니다.
     * 3. 채점 결과와 문제 정보를 학습 시도 테이블에 저장합니다.
     * 4. 프론트에서 사용하는 채점 응답 DTO를 반환합니다.
     *
     * @param request 답안 제출 정보
     * @param email 현재 로그인한 사용자 이메일
     * @return 채점 결과 응답
     */
    @Transactional
    public LearningAttemptResponseDto gradeAttempt(LearningAttemptRequestDto request, String email) {
        UserEntity user = getUser(email);
        LearningSubjectEntity subject = request.subjectId() != null
                ? getSubject(request.subjectId())
                : null;

        GradeResultDto result = aiService.gradeLearningAnswer(
                request.question(),
                request.correctAnswer(),
                request.userAnswer(),
                request.explanation()
        );

        LearningAttemptEntity attempt = LearningAttemptEntity.builder()
                .user(user)
                .sessionKey(request.sessionKey())
                .sessionProblemCount(request.sessionProblemCount())
                .sessionProblemOrder(request.sessionProblemOrder())
                .subject(subject)
                .difficulty(request.difficulty())
                .problemType(request.problemType())
                .question(request.question())
                .correctAnswer(request.correctAnswer())
                .userAnswer(request.userAnswer())
                .aiFeedback(result.feedback())
                .isCorrect(result.correct())
                .build();

        learningAttemptRepository.save(attempt);

        return new LearningAttemptResponseDto(result.correct(), result.feedback());
    }

    /**
     * 같은 학습 세션 키로 저장된 결과를 다시 읽어옵니다.
     * 프런트 새로고침 이후에도 부분 완료 결과를 복원하기 위한 용도입니다.
     */
    public LearningSessionResultResponseDto getSessionResult(String sessionKey, String email) {
        UserEntity user = getUser(email);
        List<LearningAttemptEntity> attempts = learningAttemptRepository
                .findByUserIdAndSessionKeyWithSubjectOrderBySessionProblemOrder(user.getId(), sessionKey);

        if (attempts.isEmpty()) {
            throw new BusinessException(ErrorCode.NOT_FOUND);
        }

        LearningAttemptEntity firstAttempt = attempts.get(0);
        int completedProblemCount = attempts.size();
        int totalProblemCount = firstAttempt.getSessionProblemCount() != null
                ? firstAttempt.getSessionProblemCount()
                : completedProblemCount;
        int correctCount = (int) attempts.stream()
                .filter(LearningAttemptEntity::isCorrect)
                .count();
        int accuracyRate = calculateAccuracyRate(completedProblemCount, correctCount);
        boolean partialCompletion = completedProblemCount < totalProblemCount;

        return new LearningSessionResultResponseDto(
                sessionKey,
                firstAttempt.getSubject() != null ? firstAttempt.getSubject().getId() : null,
                firstAttempt.getSubject() != null ? firstAttempt.getSubject().getName() : null,
                firstAttempt.getDifficulty(),
                totalProblemCount,
                completedProblemCount,
                correctCount,
                accuracyRate,
                partialCompletion,
                attempts.stream()
                        .map(LearningSessionResultItemDto::from)
                        .toList()
        );
    }

    /**
     * 사용자의 오답 목록을 조회합니다.
     *
     * @param email 현재 로그인한 사용자 이메일
     * @return 오답 항목 목록
     */
    public List<WrongLearningAttemptDto> getWrongAttempts(String email) {
        UserEntity user = getUser(email);
        // N+1 방지: subject를 JOIN FETCH하여 한 번의 쿼리로 조회
        return learningAttemptRepository
                .findWrongAnswersByUserIdWithSubject(user.getId())
                .stream()
                .map(WrongLearningAttemptDto::from)
                .toList();
    }

    /**
     * 사용자별 학습 통계를 계산합니다.
     *
     * [동작 방식]
     * 1. 사용자의 전체 학습 시도 목록을 조회합니다.
     * 2. 총 시도 수, 정답 수, 정답률을 계산합니다.
     * 3. 과목별로 묶어서 과목별 통계를 계산합니다.
     * 4. 최근 시도 5건을 별도 목록으로 만들어 반환합니다.
     *
     * @param email 현재 로그인한 사용자 이메일
     * @return 학습 통계 응답
     */
    public LearningStatsResponseDto getStats(String email) {
        UserEntity user = getUser(email);
        // N+1 방지: subject를 JOIN FETCH하여 한 번의 쿼리로 조회
        List<LearningAttemptEntity> attempts = learningAttemptRepository.findByUserIdWithSubjectOrderByCreatedAtDesc(user.getId());

        long totalAttempts = attempts.size();
        long correctAttempts = attempts.stream()
                .filter(LearningAttemptEntity::isCorrect)
                .count();

        int accuracyRate = calculateAccuracyRate(totalAttempts, correctAttempts);

        List<LearningSubjectStatsDto> subjectStats = attempts.stream()
                .collect(Collectors.groupingBy(attempt -> {
                    if (attempt.getSubject() == null || attempt.getSubject().getName() == null) {
                        return "미분류";
                    }
                    return attempt.getSubject().getName();
                }))
                .entrySet()
                .stream()
                .map(this::toSubjectStats)
                .sorted(Comparator.comparingLong(LearningSubjectStatsDto::totalAttempts).reversed())
                .toList();

        List<LearningRecentAttemptDto> recentAttempts = attempts.stream()
                .limit(5)
                .map(LearningRecentAttemptDto::from)
                .toList();

        return new LearningStatsResponseDto(
                totalAttempts,
                correctAttempts,
                accuracyRate,
                subjectStats,
                recentAttempts
        );
    }

    /**
     * 사용자별 카테고리(과목) 정답률을 분석하여 약점을 표시합니다.
     *
     * [동작 방식]
     * 1. 과목이 지정된 시도만 집계합니다 (null 과목은 통계 신뢰도가 낮아 제외).
     * 2. 과목별로 묶어 정답률을 계산하고 정확도 오름차순으로 정렬합니다.
     * 3. 정답률 < 60% 이고 시도 횟수 >= 3인 과목을 약점(isWeak=true)으로 표시합니다.
     *
     * @param email 현재 로그인한 사용자 이메일
     * @return 카테고리별 분석 결과
     */
    public LearningAnalyticsResponseDto getAnalytics(String email) {
        UserEntity user = getUser(email);
        // N+1 방지: subject를 JOIN FETCH하여 한 번의 쿼리로 조회
        List<LearningAttemptEntity> attempts = learningAttemptRepository.findByUserIdWithSubjectOrderByCreatedAtDesc(user.getId());

        List<CategoryAnalyticsDto> categories = attempts.stream()
                .filter(a -> a.getSubject() != null)
                .collect(Collectors.groupingBy(a -> a.getSubject().getName()))
                .entrySet().stream()
                .map(entry -> {
                    long totalCount = entry.getValue().size();
                    long correctCount = entry.getValue().stream()
                            .filter(LearningAttemptEntity::isCorrect).count();
                    int accuracy = calculateAccuracyRate(totalCount, correctCount);
                    boolean isWeak = accuracy < 60 && totalCount >= 3;
                    return new CategoryAnalyticsDto(entry.getKey(), totalCount, correctCount, accuracy, isWeak);
                })
                .sorted(Comparator.comparingInt(CategoryAnalyticsDto::accuracy))
                .toList();

        return new LearningAnalyticsResponseDto(categories);
    }

    /**
     * 사용자의 학습 이력을 분석하여 가장 연습이 필요한 과목을 추천합니다.
     *
     * [추천 우선순위]
     * 1. 약점 과목 (정답률 < 60%, 시도 횟수 >= 3) 중 정답률이 가장 낮은 과목
     * 2. 약점 없으면: 전체 과목 중 시도 횟수가 가장 적은 과목
     *
     * [난이도 결정]
     * - 정답률 < 30%: EASY (기초 재정립)
     * - 정답률 30~59%: MEDIUM
     * - 약점 아닌 추천: MEDIUM
     *
     * @param email 현재 로그인한 사용자 이메일
     * @return 추천 과목 정보, 등록된 과목이 없으면 null
     */
    public LearningRecommendationDto getRecommendation(String email) {
        UserEntity user = getUser(email);
        // N+1 방지: subject를 JOIN FETCH하여 한 번의 쿼리로 조회
        List<LearningAttemptEntity> attempts = learningAttemptRepository.findByUserIdWithSubjectOrderByCreatedAtDesc(user.getId());

        // 과목 ID → 시도 목록 매핑 (subject가 있는 시도만)
        Map<Long, List<LearningAttemptEntity>> bySubjectId = attempts.stream()
                .filter(a -> a.getSubject() != null)
                .collect(Collectors.groupingBy(a -> a.getSubject().getId()));

        // 1단계: 약점 과목 탐색
        Optional<Map.Entry<Long, List<LearningAttemptEntity>>> weakest = bySubjectId.entrySet().stream()
                .filter(e -> {
                    long total = e.getValue().size();
                    long correct = e.getValue().stream().filter(LearningAttemptEntity::isCorrect).count();
                    return total >= 3 && calculateAccuracyRate(total, correct) < 60;
                })
                .min(Comparator.comparingInt(e -> {
                    long total = e.getValue().size();
                    long correct = e.getValue().stream().filter(LearningAttemptEntity::isCorrect).count();
                    return calculateAccuracyRate(total, correct);
                }));

        if (weakest.isPresent()) {
            List<LearningAttemptEntity> weakAttempts = weakest.get().getValue();
            LearningSubjectEntity subject = weakAttempts.get(0).getSubject();
            long total = weakAttempts.size();
            long correct = weakAttempts.stream().filter(LearningAttemptEntity::isCorrect).count();
            int accuracy = calculateAccuracyRate(total, correct);
            String difficulty = accuracy < 30 ? "EASY" : "MEDIUM";
            String reason = subject.getName() + " 과목 정답률이 " + accuracy + "%입니다. 기초 개념을 다시 다져보세요.";
            return new LearningRecommendationDto(subject.getId(), subject.getName(), difficulty, accuracy, reason);
        }

        // 2단계: 폴백 — 시도 횟수가 가장 적은 과목 추천
        List<LearningSubjectEntity> allSubjects = learningRepository.findAll();
        if (allSubjects.isEmpty()) {
            return null;
        }

        LearningSubjectEntity leastPracticed = allSubjects.stream()
                .min(Comparator.comparingLong(s -> bySubjectId.getOrDefault(s.getId(), List.of()).size()))
                .orElse(allSubjects.get(0));

        List<LearningAttemptEntity> leastAttempts = bySubjectId.getOrDefault(leastPracticed.getId(), List.of());
        long total = leastAttempts.size();
        int accuracy = 0;
        if (total > 0) {
            long correct = leastAttempts.stream().filter(LearningAttemptEntity::isCorrect).count();
            accuracy = calculateAccuracyRate(total, correct);
        }

        String reason = total == 0
                ? leastPracticed.getName() + " 과목을 아직 학습하지 않았습니다. 도전해보세요."
                : leastPracticed.getName() + " 과목의 학습 기록이 적습니다. 더 많이 연습해보세요.";

        return new LearningRecommendationDto(leastPracticed.getId(), leastPracticed.getName(), "MEDIUM", accuracy, reason);
    }

    /**
     * 과목별 통계 묶음을 DTO로 변환합니다.
     *
     * @param entry 과목명과 시도 목록 묶음
     * @return 과목별 통계 DTO
     */
    private LearningSubjectStatsDto toSubjectStats(Map.Entry<String, List<LearningAttemptEntity>> entry) {
        long totalAttempts = entry.getValue().size();
        long correctAttempts = entry.getValue().stream()
                .filter(LearningAttemptEntity::isCorrect)
                .count();

        return new LearningSubjectStatsDto(
                entry.getKey(),
                totalAttempts,
                correctAttempts,
                calculateAccuracyRate(totalAttempts, correctAttempts)
        );
    }

    /**
     * 총 시도 수와 정답 수를 기반으로 정답률을 계산합니다.
     *
     * @param totalAttempts 전체 시도 수
     * @param correctAttempts 정답 수
     * @return 0부터 100까지의 정답률
     */
    private int calculateAccuracyRate(long totalAttempts, long correctAttempts) {
        if (totalAttempts == 0) {
            return 0;
        }
        return (int) Math.round((double) correctAttempts / totalAttempts * 100);
    }

    /**
     * 이메일로 사용자를 조회합니다.
     *
     * @param email 사용자 이메일
     * @return 사용자 엔티티
     */
    private UserEntity getUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));
    }

    /**
     * 과목 ID로 학습 과목을 조회합니다.
     *
     * @param subjectId 과목 ID
     * @return 학습 과목 엔티티
     */
    private LearningSubjectEntity getSubject(Long subjectId) {
        return learningRepository.findById(subjectId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
    }
}
