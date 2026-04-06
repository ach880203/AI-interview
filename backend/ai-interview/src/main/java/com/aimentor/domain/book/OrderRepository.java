package com.aimentor.domain.book;

import com.aimentor.domain.user.UserEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * 주문 엔티티 전용 JPA 레포지토리입니다.
 *
 * [역할]
 * 사용자별 주문 목록 조회와 관리자 통계용 주문 상태 개수 집계를 제공합니다.
 */
public interface OrderRepository extends JpaRepository<OrderEntity, Long> {

    /**
     * 특정 사용자의 주문 목록을 최신순으로 조회합니다.
     *
     * @param user 사용자 엔티티
     * @return 최신순 주문 목록
     */
    List<OrderEntity> findByUserOrderByOrderedAtDesc(UserEntity user);

    /**
     * 특정 사용자의 주문 단건을 조회합니다.
     *
     * @param id 주문 ID
     * @param user 사용자 엔티티
     * @return 주문 단건 조회 결과
     */
    Optional<OrderEntity> findByIdAndUser(Long id, UserEntity user);

    /**
     * 특정 상태의 주문 개수를 조회합니다.
     *
     * @param status 주문 상태
     * @return 해당 상태 주문 수
     */
    long countByStatus(OrderEntity.OrderStatus status);

    /**
     * 특정 상태들에 해당하는 주문 목록을 기간별로 조회합니다.
     * 매출 통계 집계에 사용합니다.
     *
     * @param statuses 조회할 주문 상태 목록
     * @param start 시작 일시 (포함)
     * @param end 종료 일시 (미포함)
     * @return 조건에 맞는 주문 목록
     */
    List<OrderEntity> findAllByStatusInAndOrderedAtGreaterThanEqualAndOrderedAtLessThan(
            List<OrderEntity.OrderStatus> statuses,
            LocalDateTime start,
            LocalDateTime end
    );

    /**
     * 특정 상태들에 해당하는 전체 주문 목록을 조회합니다.
     * 전체 기간 매출 통계에 사용합니다.
     *
     * @param statuses 조회할 주문 상태 목록
     * @return 조건에 맞는 주문 목록
     */
    List<OrderEntity> findAllByStatusIn(List<OrderEntity.OrderStatus> statuses);
}
