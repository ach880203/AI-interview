package com.aimentor.domain.interview.dto;

import com.aimentor.domain.interview.InterviewSessionEntity;

import java.time.LocalDateTime;

/**
 * 면접 세션 목록 응답 DTO입니다.
 *
 * [역할]
 * GET /api/interviews/sessions 응답에서 각 세션의 핵심 정보만 가볍게 내려줍니다.
 *
 * [이번 변경 이유]
 * 목록 화면에서도 부분 완료 상태와 답변 진행률을 보여줘야
 * 사용자가 어떤 세션이 중간 종료였는지 바로 이해할 수 있습니다.
 */
public record SessionSummaryResponseDto(
        Long id,
        InterviewSessionEntity.SessionStatus status,
        Long resumeId,
        Long coverLetterId,
        Long jobPostingId,
        LocalDateTime startedAt,
        LocalDateTime endedAt,
        LocalDateTime createdAt,
        Integer plannedQuestionCount,
        Integer answeredQuestionCount,
        Boolean partialCompleted,
        Boolean feedbackReady,
        String resumeName,
        String company,
        String position
) {
    public static SessionSummaryResponseDto from(
            InterviewSessionEntity session,
            boolean feedbackReady,
            String resumeName,
            String company,
            String position
    ) {
        return new SessionSummaryResponseDto(
                session.getId(),
                session.getStatus(),
                session.getResumeId(),
                session.getCoverLetterId(),
                session.getJobPostingId(),
                session.getStartedAt(),
                session.getEndedAt(),
                session.getCreatedAt(),
                session.getPlannedQuestionCount(),
                session.getAnsweredQuestionCount(),
                session.isPartialCompleted(),
                feedbackReady,
                resumeName,
                company,
                position
        );
    }
}
