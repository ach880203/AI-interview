package com.aimentor.domain.subscription.dto;

import com.aimentor.domain.subscription.SubscriptionPaymentMethod;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/**
 * 구독 결제 요청 DTO입니다.
 *
 * [입력 규칙]
 * - planKey: 프런트에서 선택한 요금제 키
 * - paymentMethod: 현재는 카카오페이만 허용
 */
public record SubscriptionCreateRequestDto(
        @NotBlank(message = "구독 요금제를 선택해 주세요.")
        String planKey,

        @NotNull(message = "결제 수단을 선택해 주세요.")
        SubscriptionPaymentMethod paymentMethod
) {
}
