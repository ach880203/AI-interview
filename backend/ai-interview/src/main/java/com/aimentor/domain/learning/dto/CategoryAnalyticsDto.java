package com.aimentor.domain.learning.dto;

/**
 * 카테고리별 학습 분석 DTO
 *
 * [역할]
 * LearningAnalyticsResponseDto.categories 항목으로 사용됩니다.
 * 과목별 정답률과 취약 여부를 나타냅니다.
 *
 * [isWeak 기준]
 * 정답률이 60% 미만이면 취약 과목으로 분류합니다.
 */
public record CategoryAnalyticsDto(
        /** 과목명 */
        String subjectName,
        /** 총 시도 횟수 */
        long totalCount,
        /** 정답 횟수 */
        long correctCount,
        /** 정답률 (%) */
        int accuracy,
        /** 취약 과목 여부 (정답률 60% 미만이면 true) */
        boolean isWeak
) {}
