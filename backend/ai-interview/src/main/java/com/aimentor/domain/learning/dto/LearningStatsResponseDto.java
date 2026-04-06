package com.aimentor.domain.learning.dto;

import java.util.List;

/**
 * 학습 통계 응답 DTO
 *
 * [역할]
 * GET /api/learning/stats 응답에 사용합니다.
 * 전체 시도 횟수, 정답률, 과목별 통계, 최근 시도 목록을 담습니다.
 */
public record LearningStatsResponseDto(
        /** 전체 시도 횟수 */
        long totalAttempts,
        /** 전체 정답 횟수 */
        long correctAttempts,
        /** 전체 정답률 (%) */
        int accuracyRate,
        /** 과목별 통계 목록 */
        List<LearningSubjectStatsDto> subjectStats,
        /** 최근 시도 목록 (최대 5개) */
        List<LearningRecentAttemptDto> recentAttempts
) {}
