package com.aimentor.domain.interview;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 면접 세션 JPA 리포지토리
 */
public interface InterviewRepository extends JpaRepository<InterviewSessionEntity, Long> {

    /** 사용자의 세션 목록 (최신순) */
    List<InterviewSessionEntity> findByUserIdOrderByStartedAtDesc(Long userId);

    /** 오늘 시작된 면접 세션 수 (일일 사용 제한 체크용) */
    int countByUserIdAndStartedAtGreaterThanEqual(Long userId, LocalDateTime startOfDay);
}
