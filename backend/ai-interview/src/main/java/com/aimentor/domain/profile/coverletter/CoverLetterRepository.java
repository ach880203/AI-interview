package com.aimentor.domain.profile.coverletter;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

/**
 * 자기소개서 JPA 리포지토리
 */
public interface CoverLetterRepository extends JpaRepository<CoverLetterEntity, Long> {

    List<CoverLetterEntity> findByUserIdOrderByCreatedAtDesc(Long userId);

    /** ID + 소유자 ID 조건 조회 — 타 사용자 문서 접근 방지 */
    Optional<CoverLetterEntity> findByIdAndUserId(Long id, Long userId);
}
