package com.aimentor.domain.support;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

/**
 * 고객센터 FAQ 저장소입니다.
 *
 * [역할]
 * 고객센터와 관리자 화면에서 같은 FAQ 목록을 순서 있게 조회합니다.
 */
public interface CustomerCenterFaqRepository extends JpaRepository<CustomerCenterFaqEntity, Long> {

    List<CustomerCenterFaqEntity> findAllByOrderByCreatedAtAsc();

    boolean existsByQuestion(String question);
}
