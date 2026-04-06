package com.aimentor.external.payment.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * PortOne 결제 검증 요청 DTO
 *
 * [역할]
 * 프론트엔드가 PortOne SDK로 결제 후 받은 paymentId를 전달합니다.
 * 백엔드는 이 paymentId로 PortOne V2 API에 결제 내역을 조회해 금액과 상태를 검증합니다.
 *
 * [paymentId 형식]
 * "order_{orderId}_{timestamp}" — OrderPaymentPage에서 생성해서 SDK에 전달
 */
public record PortOneVerifyRequestDto(
        @NotBlank(message = "paymentId는 필수입니다.")
        String paymentId
) {}
