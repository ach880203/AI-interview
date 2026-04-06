package com.aimentor.domain.subscription;

/**
 * 구독 결제 수단입니다.
 *
 * [설계 이유]
 * 현재 서비스 기획상 구독은 카카오페이 단일 흐름으로 안내하고 있으므로
 * 문자열 상수를 여기저기 흩뿌리지 않고 enum으로 고정해 두면
 * 프런트/백엔드가 같은 값을 안정적으로 사용할 수 있습니다.
 */
public enum SubscriptionPaymentMethod {
    KAKAOPAY
}
