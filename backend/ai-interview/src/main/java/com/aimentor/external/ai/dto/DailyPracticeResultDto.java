package com.aimentor.external.ai.dto;

/**
 * 오늘의 연습질문 평가 결과 DTO
 *
 * @param score    평가 점수 (0~100)
 * @param feedback 간결한 피드백 (3~5문장)
 */
public record DailyPracticeResultDto(
        int score,
        String feedback
) {}
