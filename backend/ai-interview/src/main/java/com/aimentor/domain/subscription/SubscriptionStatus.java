package com.aimentor.domain.subscription;

/**
 * 구독 상태입니다.
 *
 * [주의]
 * 주문과 마찬가지로 결제 결과를 나눠 저장해야
 * "결제 대기 중인지", "실패했는지", "취소했는지"를 화면에 정확히 보여 줄 수 있습니다.
 */
public enum SubscriptionStatus {
    PENDING,
    ACTIVE,
    EXPIRED,
    CANCELLED,
    PAYMENT_FAILED
}
