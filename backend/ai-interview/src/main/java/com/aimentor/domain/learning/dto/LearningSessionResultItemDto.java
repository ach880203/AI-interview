package com.aimentor.domain.learning.dto;

import com.aimentor.domain.learning.LearningAttemptEntity;

/**
 * 학습 세션 결과의 문제별 상세 DTO입니다.
 *
 * [역할]
 * 부분 완료 또는 전체 완료 결과를 다시 열었을 때
 * 문제 순서, 정답 여부, AI 피드백을 그대로 복원하기 위해 사용합니다.
 */
public record LearningSessionResultItemDto(
        Integer sessionProblemOrder,
        String question,
        String userAnswer,
        String correctAnswer,
        Boolean correct,
        String aiFeedback
) {
    public static LearningSessionResultItemDto from(LearningAttemptEntity attempt) {
        return new LearningSessionResultItemDto(
                attempt.getSessionProblemOrder(),
                attempt.getQuestion(),
                attempt.getUserAnswer(),
                attempt.getCorrectAnswer(),
                attempt.isCorrect(),
                attempt.getAiFeedback()
        );
    }
}
