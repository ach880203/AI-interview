package com.aimentor.domain.support;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

/**
 * 고객센터 문의 저장소입니다.
 *
 * [역할]
 * 사용자별 문의 목록과 관리자 전체 문의 목록을 최신 순으로 조회합니다.
 */
public interface CustomerCenterInquiryRepository extends JpaRepository<CustomerCenterInquiryEntity, Long> {

    List<CustomerCenterInquiryEntity> findAllByUserIdOrderByCreatedAtDesc(Long userId);

    List<CustomerCenterInquiryEntity> findAllByOrderByCreatedAtDesc();

    /** 공개 문의 페이징 조회 (답변 완료된 것만) */
    Page<CustomerCenterInquiryEntity> findAllByIsPublicTrueAndStatus(
            CustomerCenterInquiryEntity.InquiryStatus status, Pageable pageable);

    /**
     * 공개 문의 페이징 조회 (전체 상태 포함)
     * 새 공개 문의도 바로 목록에 표시하기 위해 상태 필터 없이 조회합니다.
     */
    Page<CustomerCenterInquiryEntity> findAllByIsPublicTrue(Pageable pageable);
}
