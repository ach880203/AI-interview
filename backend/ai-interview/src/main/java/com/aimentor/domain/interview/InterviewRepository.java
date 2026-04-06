package com.aimentor.domain.interview;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

/**
 * 면접 세션 JPA 리포지토리
 */
public interface InterviewRepository extends JpaRepository<InterviewSessionEntity, Long> {

    /** 사용자의 세션 목록 (최신순) */
    List<InterviewSessionEntity> findByUserIdOrderByStartedAtDesc(Long userId);
}
