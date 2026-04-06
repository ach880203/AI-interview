package com.aimentor.domain.interview;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

/**
 * 면접 피드백 JPA 리포지토리
 */
public interface InterviewFeedbackRepository extends JpaRepository<InterviewFeedbackEntity, Long> {

    /** 세션 ID로 피드백 조회 (세션 종료 후 1개 존재) */
    Optional<InterviewFeedbackEntity> findBySessionId(Long sessionId);

    /**
     * 대시보드 목록에서 완료 세션의 피드백 존재 여부를 한 번에 확인합니다.
     * 세션마다 exists 쿼리를 반복하면 목록 수만큼 쿼리가 늘어날 수 있어 배치 조회로 묶습니다.
     */
    @Query("select feedback.session.id from InterviewFeedbackEntity feedback where feedback.session.id in :sessionIds")
    List<Long> findExistingSessionIds(@Param("sessionIds") List<Long> sessionIds);

    /**
     * 성장 추적용 — 사용자의 완료된 면접 피드백을 세션 시작 시간 오름차순으로 조회합니다.
     *
     * [역할]
     * 단일 쿼리로 모든 회차 점수를 가져와 N+1 문제를 방지합니다.
     * 프론트엔드는 이 목록을 그대로 차트 데이터로 사용합니다.
     */
    List<InterviewFeedbackEntity> findBySession_User_IdAndSession_StatusOrderBySession_StartedAtAsc(
            Long userId, InterviewSessionEntity.SessionStatus status);
}
