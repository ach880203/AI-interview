package com.aimentor.domain.learning.dto;

import com.aimentor.domain.learning.LearningAttemptEntity;

import java.time.LocalDateTime;

/**
 * 오답 항목 DTO
 *
 * [역할]
 * GET /api/learning/wrong-answers 응답에 사용합니다.
 * 사용자가 틀렸던 문제의 상세 정보를 담아
 * 오답노트에서 다시 확인할 수 있게 합니다.
 */
public record WrongLearningAttemptDto(

        /** 시도 ID */
        Long id,

        /** 과목명 */
        String subjectName,

        /** 난이도 */
        String difficulty,

        /** 문제 유형 (MULTIPLE / SHORT) */
        String problemType,

        /** 문제 본문 */
        String question,

        /** 정답 */
        String correctAnswer,

        /** 사용자가 제출한 답변 */
        String userAnswer,

        /** AI 피드백 */
        String aiFeedback,

        /** 시도 일시 */
        LocalDateTime createdAt

) {
    /**
     * 엔티티 → DTO 변환 팩토리 메서드
     *
     * @param attempt 학습 시도 엔티티
     * @return 오답 항목 DTO
     */
    public static WrongLearningAttemptDto from(LearningAttemptEntity attempt) {
        String subjectName = attempt.getSubject() != null
                ? attempt.getSubject().getName()
                : null;

        return new WrongLearningAttemptDto(
                attempt.getId(),
                subjectName,
                attempt.getDifficulty(),
                attempt.getProblemType(),
                attempt.getQuestion(),
                attempt.getCorrectAnswer(),
                attempt.getUserAnswer(),
                attempt.getAiFeedback(),
                attempt.getCreatedAt()
        );
    }
}
