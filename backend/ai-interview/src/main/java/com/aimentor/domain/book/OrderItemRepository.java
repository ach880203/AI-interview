package com.aimentor.domain.book;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

/**
 * 주문 항목 JPA 리포지토리
 */
public interface OrderItemRepository extends JpaRepository<OrderItemEntity, Long> {

    /** 주문 ID로 항목 목록 조회 */
    List<OrderItemEntity> findByOrderId(Long orderId);

    /** 복수 주문 ID로 항목 목록 배치 조회 (N+1 방지) */
    List<OrderItemEntity> findByOrderIdIn(List<Long> orderIds);
}
