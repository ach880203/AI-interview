package com.aimentor.domain.profile.resume;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

/**
 * 이력서 JPA 리포지토리
 */
public interface ResumeRepository extends JpaRepository<ResumeEntity, Long> {

    /** 사용자의 이력서 목록 (최신순) */
    List<ResumeEntity> findByUserIdOrderByCreatedAtDesc(Long userId);

    /** ID + 소유자 ID 조건 조회 — 타 사용자 문서 접근 방지 */
    Optional<ResumeEntity> findByIdAndUserId(Long id, Long userId);
}
