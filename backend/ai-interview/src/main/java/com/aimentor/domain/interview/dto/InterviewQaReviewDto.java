package com.aimentor.domain.interview.dto;

import com.aimentor.domain.interview.InterviewQaEntity;

import java.time.LocalDateTime;

/**
 * 면접 Q&A 복습 항목 DTO
 *
 * [역할]
 * GET /api/interviews/review (오답노트) 응답에 사용합니다.
 * 완료된 면접 세션에서 질문과 내 답변을 다시 확인할 수 있게 합니다.
 *
 * [사용 흐름]
 * InterviewService.getQaHistory() → qaRepository 조회
 *   → InterviewQaReviewDto.from(entity) → API 응답
 */
public record InterviewQaReviewDto(

        /** Q&A 항목 ID */
        Long id,

        /** 면접 세션 ID */
        Long sessionId,

        /** 질문 순서 (1부터 시작) */
        int orderNum,

        /** AI가 생성한 면접 질문 */
        String question,

        /** 사용자가 제출한 답변 */
        String answerText,

        /** 질문 생성 일시 */
        LocalDateTime createdAt

) {
    /**
     * 엔티티 → DTO 변환 팩토리 메서드
     *
     * @param qa 면접 Q&A 엔티티
     * @return 복습 항목 DTO
     */
    public static InterviewQaReviewDto from(InterviewQaEntity qa) {
        return new InterviewQaReviewDto(
                qa.getId(),
                qa.getSession().getId(),
                qa.getOrderNum(),
                qa.getQuestion(),
                qa.getAnswerText(),
                qa.getCreatedAt()
        );
    }
}
