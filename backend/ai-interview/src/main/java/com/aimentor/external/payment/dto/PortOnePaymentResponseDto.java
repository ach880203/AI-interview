package com.aimentor.external.payment.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * PortOne V2 결제 조회 API 응답 DTO
 *
 * [매핑 대상]
 * GET https://api.portone.io/payments/{paymentId}
 * 응답 본문에서 결제 상태 · 금액만 추출합니다.
 */
public record PortOnePaymentResponseDto(
        String id,
        String status,
        @JsonProperty("orderName") String orderName,
        Amount amount
) {
    /**
     * 결제 금액 내부 객체 (PortOne V2 금액 구조)
     * paid: 실제 결제 완료된 금액
     * total: 요청 금액 (= 주문 금액)
     */
    public record Amount(
            Integer paid,
            Integer total
    ) {}

    /** 결제가 완료된 상태인지 확인합니다. */
    public boolean isPaid() {
        return "PAID".equals(status);
    }
}
