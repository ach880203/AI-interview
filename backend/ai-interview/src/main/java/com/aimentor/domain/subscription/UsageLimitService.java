package com.aimentor.domain.subscription;

import com.aimentor.common.BusinessException;
import com.aimentor.common.ErrorCode;
import com.aimentor.domain.interview.InterviewRepository;
import com.aimentor.domain.learning.LearningAttemptRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 일일 사용 횟수 제한 서비스
 *
 * [정책]
 * - 비구독자: 면접 1회/일, 학습 1회/일
 * - 구독자(daily/weekly/monthly/yearly): 구독 기간 내 무제한
 *
 * [체크 시점]
 * - 면접: 세션 시작(startSession) 전
 * - 학습: 문제 생성(generateProblems) 전
 *   같은 sessionKey로 재시도하는 경우는 1회로 간주하여 허용합니다.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class UsageLimitService {

    private static final int DAILY_FREE_LIMIT = 1;

    private final SubscriptionRepository subscriptionRepository;
    private final InterviewRepository interviewRepository;
    private final LearningAttemptRepository learningAttemptRepository;

    /**
     * 면접 일일 사용 제한을 체크합니다.
     *
     * @param userId 사용자 ID
     * @throws BusinessException DAILY_USAGE_LIMIT_EXCEEDED — 오늘 이미 1회 사용
     */
    public void checkInterviewUsage(Long userId) {
        LocalDateTime now = LocalDateTime.now();
        if (hasActiveSubscription(userId, now)) {
            return;
        }

        LocalDateTime startOfDay = LocalDate.now().atStartOfDay();
        int todayCount = interviewRepository.countByUserIdAndStartedAtGreaterThanEqual(userId, startOfDay);
        if (todayCount >= DAILY_FREE_LIMIT) {
            throw new BusinessException(ErrorCode.DAILY_USAGE_LIMIT_EXCEEDED);
        }
    }

    /**
     * 학습 일일 사용 제한을 체크합니다.
     * 같은 sessionKey로 재시도하는 경우는 제한에 포함하지 않습니다.
     *
     * @param userId     사용자 ID
     * @param sessionKey 현재 학습 세션 키 (null 허용 — null이면 무조건 체크)
     * @throws BusinessException DAILY_USAGE_LIMIT_EXCEEDED — 오늘 이미 1회 사용
     */
    public void checkLearningUsage(Long userId, String sessionKey) {
        LocalDateTime now = LocalDateTime.now();
        if (hasActiveSubscription(userId, now)) {
            return;
        }

        // 같은 sessionKey로 재시도하는 경우 → 이미 1회 카운트됐으므로 허용
        if (sessionKey != null && learningAttemptRepository.existsByUserIdAndSessionKey(userId, sessionKey)) {
            return;
        }

        LocalDateTime startOfDay = LocalDate.now().atStartOfDay();
        int todayDistinctSessions = learningAttemptRepository.countDistinctSessionKeyByUserIdSince(userId, startOfDay);
        if (todayDistinctSessions >= DAILY_FREE_LIMIT) {
            throw new BusinessException(ErrorCode.DAILY_USAGE_LIMIT_EXCEEDED);
        }
    }

    private boolean hasActiveSubscription(Long userId, LocalDateTime now) {
        List<SubscriptionEntity> activeSubscriptions =
                subscriptionRepository.findAllByUserIdAndStatus(userId, SubscriptionStatus.ACTIVE);
        return activeSubscriptions.stream()
                .anyMatch(s -> s.isCurrentlyActive(now));
    }
}
