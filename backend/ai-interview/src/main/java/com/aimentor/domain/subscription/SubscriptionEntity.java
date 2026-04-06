package com.aimentor.domain.subscription;

import com.aimentor.common.BaseTimeEntity;
import com.aimentor.domain.user.UserEntity;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 구독 엔티티입니다.
 *
 * [역할]
 * 사용자가 어떤 요금제를 언제 결제했고,
 * 현재 활성 상태인지 아닌지를 서버 기준으로 저장합니다.
 */
@Entity
@Table(
        name = "subscriptions",
        indexes = {
                @Index(name = "idx_subscriptions_user_id", columnList = "user_id"),
                @Index(name = "idx_subscriptions_status", columnList = "status"),
                @Index(name = "idx_subscriptions_expires_at", columnList = "expires_at")
        }
)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class SubscriptionEntity extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private UserEntity user;

    @Column(name = "plan_key", nullable = false, length = 30)
    private String planKey;

    @Column(name = "plan_name", nullable = false, length = 50)
    private String planName;

    @Column(name = "duration_days", nullable = false)
    private int durationDays;

    @Column(name = "payment_amount", nullable = false)
    private int paymentAmount;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_method", nullable = false, length = 30)
    private SubscriptionPaymentMethod paymentMethod;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private SubscriptionStatus status = SubscriptionStatus.PENDING;

    @Column(name = "started_at", nullable = false)
    private LocalDateTime startedAt;

    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    @Column(name = "subscribed_at", nullable = false)
    private LocalDateTime subscribedAt;

    /**
     * 현재 시각 기준으로 실제 활성 구독인지 계산합니다.
     */
    public boolean isCurrentlyActive(LocalDateTime now) {
        return status == SubscriptionStatus.ACTIVE && expiresAt.isAfter(now);
    }

    /**
     * 결제 승인 시점을 기준으로 구독을 활성화합니다.
     *
     * [의도]
     * 결제 대기 시간이 길어져도 실제 이용 시작일은 승인 시점으로 맞추기 위해
     * 시작일과 만료일을 여기서 다시 계산합니다.
     */
    public void markActive(LocalDateTime approvedAt) {
        this.status = SubscriptionStatus.ACTIVE;
        this.startedAt = approvedAt;
        this.expiresAt = approvedAt.plusDays(durationDays);
    }

    /**
     * 구독을 만료 상태로 바꿉니다.
     */
    public void markExpired() {
        this.status = SubscriptionStatus.EXPIRED;
    }

    /**
     * 사용자가 결제를 취소한 상태로 바꿉니다.
     */
    public void markCancelled() {
        this.status = SubscriptionStatus.CANCELLED;
    }

    /**
     * 결제 승인 실패 상태로 바꿉니다.
     */
    public void markPaymentFailed() {
        this.status = SubscriptionStatus.PAYMENT_FAILED;
    }
}
