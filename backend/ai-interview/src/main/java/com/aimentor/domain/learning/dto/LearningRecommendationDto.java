package com.aimentor.domain.learning.dto;

/**
 * 학습 추천 DTO
 *
 * [역할]
 * GET /api/learning/recommendations 응답에 사용합니다.
 * 사용자의 취약 과목을 기반으로 AI가 추천한 학습 항목입니다.
 */
public record LearningRecommendationDto(
        /** 과목 ID */
        Long subjectId,
        /** 과목명 */
        String subjectName,
        /** 추천 난이도 */
        String difficulty,
        /** 현재 정답률 (%) */
        int accuracyRate,
        /** 추천 이유 */
        String reason
) {}
