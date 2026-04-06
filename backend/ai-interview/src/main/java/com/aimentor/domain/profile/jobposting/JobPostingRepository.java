package com.aimentor.domain.profile.jobposting;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

/**
 * 채용공고 JPA 리포지토리
 */
public interface JobPostingRepository extends JpaRepository<JobPostingEntity, Long> {

    List<JobPostingEntity> findByUserIdOrderByCreatedAtDesc(Long userId);

    /** ID + 소유자 ID 조건 조회 — 타 사용자 문서 접근 방지 */
    Optional<JobPostingEntity> findByIdAndUserId(Long id, Long userId);
}
