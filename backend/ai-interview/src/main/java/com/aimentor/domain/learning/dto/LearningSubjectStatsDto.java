package com.aimentor.domain.learning.dto;

/**
 * 과목별 학습 통계 DTO
 *
 * [역할]
 * LearningStatsResponseDto.subjectStats 항목으로 사용됩니다.
 * 각 과목에서의 시도 횟수와 정답률을 나타냅니다.
 */
public record LearningSubjectStatsDto(
        /** 과목명 */
        String subjectName,
        /** 총 시도 횟수 */
        long totalAttempts,
        /** 정답 횟수 */
        long correctAttempts,
        /** 정답률 (%) */
        int accuracyRate
) {}
