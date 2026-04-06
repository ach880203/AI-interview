package com.aimentor.domain.subscription;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * 구독 저장소입니다.
 *
 * [의도]
 * 현재 활성 구독과 최근 결제 시도를 함께 다뤄야 해서
 * 최신순 조회와 사용자 소유권 검증용 메서드를 함께 둡니다.
 */
public interface SubscriptionRepository extends JpaRepository<SubscriptionEntity, Long> {

    Optional<SubscriptionEntity> findByIdAndUserId(Long id, Long userId);

    Optional<SubscriptionEntity> findTopByUserIdOrderBySubscribedAtDesc(Long userId);

    List<SubscriptionEntity> findAllByUserIdOrderBySubscribedAtDesc(Long userId);

    List<SubscriptionEntity> findAllByUserIdAndStatus(Long userId, SubscriptionStatus status);

    /**
     * 특정 상태들에 해당하는 구독을 기간별로 조회합니다.
     * 매출 통계 집계에 사용합니다.
     *
     * @param statuses 조회할 구독 상태 목록
     * @param start 시작 일시 (포함)
     * @param end 종료 일시 (미포함)
     * @return 조건에 맞는 구독 목록
     */
    List<SubscriptionEntity> findAllByStatusInAndSubscribedAtGreaterThanEqualAndSubscribedAtLessThan(
            List<SubscriptionStatus> statuses,
            LocalDateTime start,
            LocalDateTime end
    );

    /**
     * 특정 상태들에 해당하는 전체 구독 목록을 조회합니다.
     * 전체 기간 매출 통계에 사용합니다.
     *
     * @param statuses 조회할 구독 상태 목록
     * @return 조건에 맞는 구독 목록
     */
    List<SubscriptionEntity> findAllByStatusIn(List<SubscriptionStatus> statuses);
}
