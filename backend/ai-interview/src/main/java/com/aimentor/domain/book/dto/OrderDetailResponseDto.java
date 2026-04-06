package com.aimentor.domain.book.dto;

import com.aimentor.domain.book.OrderEntity;
import com.aimentor.domain.book.OrderPaymentMethod;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 주문 상세 응답 DTO
 * GET /api/orders/{id} 에서 사용 (항목 목록 포함)
 */
public record OrderDetailResponseDto(
        Long id,
        int totalPrice,
        OrderEntity.OrderStatus status,
        String postalCode,
        String address,
        String ordererName,
        String ordererPhone,
        OrderPaymentMethod paymentMethod,
        LocalDateTime orderedAt,
        List<OrderItemResponseDto> items
) {
    public static OrderDetailResponseDto of(OrderEntity order, List<OrderItemResponseDto> items) {
        return new OrderDetailResponseDto(
                order.getId(),
                order.getTotalPrice(),
                order.getStatus(),
                order.getPostalCode(),
                order.getAddress(),
                order.getOrdererName(),
                order.getOrdererPhone(),
                order.getPaymentMethod(),
                order.getOrderedAt(),
                items
        );
    }
}
