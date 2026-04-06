package com.aimentor.common.payment;

import jakarta.validation.constraints.NotNull;

/**
 * 결제 결과 처리 요청 DTO입니다.
 *
 * [역할]
 * 실제 PG 연동 전까지는 모의 결제 화면에서 사용자가 선택한 결과를
 * 주문/구독 도메인에 공통 형식으로 전달합니다.
 *
 * [주의]
 * reason은 선택값입니다. 실패나 취소 사유를 간단히 남기고 싶을 때만 보냅니다.
 */
public record PaymentResultRequestDto(
        @NotNull(message = "결제 결과를 선택해 주세요.")
        PaymentResultType resultType,

        String reason
) {
}
