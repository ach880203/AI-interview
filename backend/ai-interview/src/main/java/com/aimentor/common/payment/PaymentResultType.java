package com.aimentor.common.payment;

/**
 * 결제 결과 종류입니다.
 *
 * [의도]
 * 주문과 구독이 같은 결제 결과 흐름을 쓰도록 공통 enum으로 분리했습니다.
 * 프런트에서는 "승인 / 실패 / 취소" 중 하나를 선택해 서버에 전달합니다.
 */
public enum PaymentResultType {
    APPROVED,
    FAILED,
    CANCELLED
}
