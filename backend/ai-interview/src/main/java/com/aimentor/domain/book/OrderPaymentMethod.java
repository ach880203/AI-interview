package com.aimentor.domain.book;

/**
 * 주문 결제 수단 열거형입니다.
 *
 * [의도]
 * 현재는 카카오페이 단일 흐름으로 먼저 운영 구조를 맞추고,
 * 이후 결제 수단이 늘어나더라도 주문 엔티티와 응답 DTO를 같은 기준으로 확장할 수 있게 합니다.
 */
public enum OrderPaymentMethod {
    KAKAOPAY
}
