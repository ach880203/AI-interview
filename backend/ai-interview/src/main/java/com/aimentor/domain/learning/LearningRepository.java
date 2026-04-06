package com.aimentor.domain.learning;

import org.springframework.data.jpa.repository.JpaRepository;

/**
 * 학습 과목 엔티티 전용 JPA 레포지토리입니다.
 *
 * [역할]
 * 학습 과목 테이블에 대한 기본 CRUD와 ID 조회 기능을 제공합니다.
 */
public interface LearningRepository extends JpaRepository<LearningSubjectEntity, Long> {
}
