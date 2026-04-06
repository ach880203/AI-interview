package com.aimentor.domain.interview.dto;

import com.aimentor.domain.interview.InterviewSessionEntity;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 면접 세션 상세 응답 DTO입니다.
 *
 * [역할]
 * GET /api/interviews/sessions/{id} 응답에서 세션 정보와 질문/답변 목록을 함께 내려줍니다.
 *
 * [이번 변경 이유]
 * 부분 완료 결과를 새로고침 뒤에도 정확히 복원하려면
 * 프런트 임시 상태가 아니라 백엔드가 저장한 질문 수와 답변 수를 같이 내려줘야 합니다.
 */
public record SessionDetailResponseDto(
        Long id,
        InterviewSessionEntity.SessionStatus status,
        Long resumeId,
        Long coverLetterId,
        Long jobPostingId,
        LocalDateTime startedAt,
        LocalDateTime endedAt,
        Integer plannedQuestionCount,
        Integer answeredQuestionCount,
        Boolean partialCompleted,
        List<QaResponseDto> qaList
) {
    public static SessionDetailResponseDto of(InterviewSessionEntity session, List<QaResponseDto> qaList) {
        return new SessionDetailResponseDto(
                session.getId(),
                session.getStatus(),
                session.getResumeId(),
                session.getCoverLetterId(),
                session.getJobPostingId(),
                session.getStartedAt(),
                session.getEndedAt(),
                session.getPlannedQuestionCount(),
                session.getAnsweredQuestionCount(),
                session.isPartialCompleted(),
                qaList
        );
    }
}
