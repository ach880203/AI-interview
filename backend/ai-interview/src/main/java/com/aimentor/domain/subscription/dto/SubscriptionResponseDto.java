package com.aimentor.domain.subscription.dto;

import com.aimentor.domain.subscription.SubscriptionEntity;

import java.time.LocalDateTime;

/**
 * 구독 응답 DTO입니다.
 *
 * [역할]
 * 프런트가 구독 상태, 금액, 기간, 현재 활성 여부를 한 번에 보여 줄 수 있게
 * 화면에 필요한 값만 모아서 전달합니다.
 */
public record SubscriptionResponseDto(
        Long id,
        String planKey,
        String planName,
        String highlight,
        int durationDays,
        int paymentAmount,
        String paymentMethod,
        String status,
        boolean active,
        LocalDateTime startedAt,
        LocalDateTime expiresAt,
        LocalDateTime subscribedAt
) {
    public static SubscriptionResponseDto from(SubscriptionEntity subscription, boolean active) {
        return new SubscriptionResponseDto(
                subscription.getId(),
                subscription.getPlanKey(),
                subscription.getPlanName(),
                subscription.getPlanName() + " 이용권",
                subscription.getDurationDays(),
                subscription.getPaymentAmount(),
                subscription.getPaymentMethod().name(),
                subscription.getStatus().name(),
                active,
                subscription.getStartedAt(),
                subscription.getExpiresAt(),
                subscription.getSubscribedAt()
        );
    }
}
