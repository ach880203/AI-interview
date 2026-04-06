package com.aimentor.domain.book;

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
 * 주문 엔티티입니다.
 *
 * [역할]
 * 주문의 금액, 배송지, 결제 수단, 상태를 함께 보관합니다.
 * 이번 변경에서는 결제 버튼을 누른 직후 바로 완료 처리하지 않고,
 * 결제 결과가 들어올 때까지 PENDING 상태를 유지하도록 구조를 정리했습니다.
 */
@Entity
@Table(
        name = "orders",
        indexes = {
                @Index(name = "idx_orders_user_id", columnList = "user_id"),
                @Index(name = "idx_orders_status", columnList = "status")
        }
)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class OrderEntity extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private UserEntity user;

    @Column(name = "total_price", nullable = false)
    private int totalPrice;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private OrderStatus status = OrderStatus.PENDING;

    @Column(nullable = false, length = 300)
    private String address;

    /**
     * 주문 시점의 우편번호입니다.
     * 이후 사용자의 기본 배송지가 바뀌어도 당시 주문 배송지를 그대로 복원하기 위해 별도로 저장합니다.
     */
    @Column(name = "postal_code", length = 10)
    private String postalCode;

    @Column(name = "orderer_name", length = 50)
    private String ordererName;

    @Column(name = "orderer_phone", length = 20)
    private String ordererPhone;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_method", length = 30)
    private OrderPaymentMethod paymentMethod;

    @Column(name = "ordered_at", nullable = false)
    private LocalDateTime orderedAt;

    @Column(name = "last_action_reason", length = 300)
    private String lastActionReason;

    @Column(name = "last_action_at")
    private LocalDateTime lastActionAt;

    /**
     * 주문 상태입니다.
     *
     * [주의]
     * PAYMENT_FAILED를 별도로 둬야 사용자 취소와 승인 실패를 구분할 수 있습니다.
     * 그래야 결과 화면과 주문 이력에서 종료 이유를 한국어로 정확히 설명할 수 있습니다.
     */
    public enum OrderStatus {
        PENDING,
        PAID,
        PAYMENT_FAILED,
        SHIPPED,
        DELIVERED,
        PURCHASE_CONFIRMED,
        CANCEL_REQUESTED,
        REFUND_REQUESTED,
        REFUNDED,
        CANCELLED
    }

    /**
     * 결제 승인 완료 상태로 바꿉니다.
     */
    public void markAsPaid() {
        this.status = OrderStatus.PAID;
        clearActionMetadata();
    }

    /**
     * 결제 실패 상태로 바꿉니다.
     *
     * [의도]
     * 단순 취소와 구분해서, PG 승인 실패였다는 점을 결과 화면에 남기기 위해 분리했습니다.
     */
    public void markAsPaymentFailed(String reason) {
        this.status = OrderStatus.PAYMENT_FAILED;
        setActionMetadata(reason);
    }

    /**
     * 배송 시작 상태로 바꿉니다.
     */
    public void markAsShipped() {
        this.status = OrderStatus.SHIPPED;
        clearActionMetadata();
    }

    /**
     * 배송 완료 상태로 바꿉니다.
     */
    public void markAsDelivered() {
        this.status = OrderStatus.DELIVERED;
        clearActionMetadata();
    }

    /**
     * 구매 확정 상태로 바꿉니다.
     */
    public void confirmPurchase(String reason) {
        this.status = OrderStatus.PURCHASE_CONFIRMED;
        setActionMetadata(reason);
    }

    /**
     * 환불 요청 상태로 바꿉니다.
     */
    public void requestRefund(String reason) {
        this.status = OrderStatus.REFUND_REQUESTED;
        setActionMetadata(reason);
    }

    /**
     * 환불 완료 상태로 바꿉니다.
     */
    public void markAsRefunded(String reason) {
        this.status = OrderStatus.REFUNDED;
        setActionMetadata(reason);
    }

    /**
     * 취소 요청 상태로 바꿉니다.
     * 관리자가 승인해야 실제 취소(CANCELLED)가 됩니다.
     */
    public void requestCancel(String reason) {
        this.status = OrderStatus.CANCEL_REQUESTED;
        setActionMetadata(reason);
    }

    /**
     * 주문 취소 상태로 바꿉니다.
     */
    public void cancel() {
        cancel(null);
    }

    /**
     * 주문 취소 상태로 바꾸고 사유를 남깁니다.
     */
    public void cancel(String reason) {
        this.status = OrderStatus.CANCELLED;
        setActionMetadata(reason);
    }

    /**
     * 마지막 처리 사유와 시각을 기록합니다.
     *
     * [주의]
     * 결제 실패, 주문 취소, 환불 요청처럼 사용자가 "왜 이 상태가 되었는지" 알아야 하는 경우에만 남깁니다.
     */
    private void setActionMetadata(String reason) {
        this.lastActionReason = reason == null || reason.isBlank() ? null : reason.trim();
        this.lastActionAt = LocalDateTime.now();
    }

    /**
     * 자동 상태 전환에서는 이전 사유가 섞이지 않도록 메타데이터를 비웁니다.
     */
    private void clearActionMetadata() {
        this.lastActionReason = null;
        this.lastActionAt = null;
    }
}
