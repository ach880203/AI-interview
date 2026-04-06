package com.aimentor.domain.interview.dto;

import com.aimentor.domain.interview.InterviewSessionEntity;

import java.time.LocalDateTime;

/**
 * 면접 세션 시작 응답 DTO
 * 세션 정보 + 첫 번째 질문을 함께 반환
 */
public record SessionStartResponseDto(
        Long sessionId,
        InterviewSessionEntity.SessionStatus status,
        Long resumeId,
        Long coverLetterId,
        Long jobPostingId,
        LocalDateTime startedAt,
        QaResponseDto firstQuestion  // 세션 시작과 동시에 생성된 첫 질문
) {
    public static SessionStartResponseDto of(InterviewSessionEntity session, QaResponseDto firstQuestion) {
        return new SessionStartResponseDto(
                session.getId(),
                session.getStatus(),
                session.getResumeId(),
                session.getCoverLetterId(),
                session.getJobPostingId(),
                session.getStartedAt(),
                firstQuestion
        );
    }
}
