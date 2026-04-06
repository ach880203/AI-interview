package com.aimentor.domain.learning.dto;

/**
 * 학습 문제 채점 결과 DTO
 *
 * [역할]
 * POST /api/learning/attempts 응답 본문을 담습니다.
 * AI가 채점한 정답 여부와 피드백을 반환합니다.
 */
public record LearningAttemptResponseDto(
        /** 정답 여부 */
        boolean correct,
        /** AI 피드백 메시지 */
        String feedback
) {}
