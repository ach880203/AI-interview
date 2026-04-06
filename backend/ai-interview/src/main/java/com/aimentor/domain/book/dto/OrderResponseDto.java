package com.aimentor.domain.book.dto;

import com.aimentor.domain.book.OrderEntity;
import com.aimentor.domain.book.OrderPaymentMethod;

import java.time.LocalDateTime;

/**
 * 주문 요약 응답 DTO (목록 조회용)
 * GET /api/orders 에서 사용 (항목 상세 미포함)
 */
public record OrderResponseDto(
        Long id,
        int totalPrice,
        OrderEntity.OrderStatus status,
        String primaryBookTitle,
        int itemCount,
        String postalCode,
        String address,
        String ordererName,
        String ordererPhone,
        OrderPaymentMethod paymentMethod,
        LocalDateTime orderedAt,
        LocalDateTime createdAt
) {
    public static OrderResponseDto from(OrderEntity order, String primaryBookTitle, int itemCount) {
        return new OrderResponseDto(
                order.getId(),
                order.getTotalPrice(),
                order.getStatus(),
                primaryBookTitle,
                itemCount,
                order.getPostalCode(),
                order.getAddress(),
                order.getOrdererName(),
                order.getOrdererPhone(),
                order.getPaymentMethod(),
                order.getOrderedAt(),
                order.getCreatedAt()
        );
    }
}
