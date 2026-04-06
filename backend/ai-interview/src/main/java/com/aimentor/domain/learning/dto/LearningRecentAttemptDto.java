package com.aimentor.domain.learning.dto;

import com.aimentor.domain.learning.LearningAttemptEntity;

import java.time.LocalDateTime;

/**
 * 최근 학습 시도 요약 DTO
 *
 * [역할]
 * LearningStatsResponseDto.recentAttempts 항목으로 사용됩니다.
 * 최근 5개 시도의 핵심 정보(과목, 문제 요약, 정답 여부)를 반환합니다.
 */
public record LearningRecentAttemptDto(

        /** 시도 ID */
        Long id,

        /** 과목명 (과목이 없으면 null) */
        String subjectName,

        /** 문제 본문 */
        String question,

        /** 정답 여부 */
        boolean correct,

        /** 시도 일시 */
        LocalDateTime createdAt

) {
    /**
     * 엔티티 → DTO 변환 팩토리 메서드
     *
     * @param attempt 학습 시도 엔티티
     * @return 최근 시도 DTO
     */
    public static LearningRecentAttemptDto from(LearningAttemptEntity attempt) {
        String subjectName = attempt.getSubject() != null
                ? attempt.getSubject().getName()
                : null;

        return new LearningRecentAttemptDto(
                attempt.getId(),
                subjectName,
                attempt.getQuestion(),
                attempt.isCorrect(),
                attempt.getCreatedAt()
        );
    }
}
