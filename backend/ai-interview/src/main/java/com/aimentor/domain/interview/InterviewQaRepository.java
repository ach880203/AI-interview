package com.aimentor.domain.interview;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

/**
 * 면접 Q&A JPA 리포지토리
 */
public interface InterviewQaRepository extends JpaRepository<InterviewQaEntity, Long> {

    /** 세션의 전체 Q&A 목록 (순서대로) */
    List<InterviewQaEntity> findBySessionIdOrderByOrderNum(Long sessionId);

    /** 특정 순서의 Q&A 조회 */
    Optional<InterviewQaEntity> findBySessionIdAndOrderNum(Long sessionId, int orderNum);

    /** 세션의 Q&A 개수 (다음 orderNum 계산용) */
    int countBySessionId(Long sessionId);

    /**
     * 답변이 실제로 저장된 질문 수만 계산합니다.
     * 전체 질문 수와 답변 수를 분리해야 부분 완료 여부를 정확히 저장할 수 있습니다.
     */
    int countBySessionIdAndAnswerTextIsNotNull(Long sessionId);

    /**
     * 특정 사용자의 완료된 면접 세션에서 모든 Q&A를 최신순으로 조회합니다.
     * 오답노트에서 면접 질문 복습 용도로 사용합니다.
     */
    List<InterviewQaEntity> findBySession_User_IdAndSession_StatusOrderByCreatedAtDesc(
            Long userId,
            InterviewSessionEntity.SessionStatus status
    );
}
