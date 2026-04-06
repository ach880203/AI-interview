package com.aimentor.domain.admin.dto;

import com.aimentor.domain.book.OrderEntity;

import java.time.LocalDateTime;

/**
 * 관리자 주문 목록 응답 DTO입니다.
 *
 * [역할]
 * 주문 주체, 주소, 금액, 상태를 관리자 화면에서 한 번에 확인할 수 있게 합니다.
 */
public record AdminOrderResponseDto(
        Long id,
        Long userId,
        String userName,
        String userEmail,
        int totalPrice,
        OrderEntity.OrderStatus status,
        String address,
        LocalDateTime orderedAt,
        LocalDateTime createdAt,
        String itemSummary
) {

    /**
     * 주문 엔티티와 상품 요약 문자열로 관리자 주문 응답 DTO를 생성합니다.
     *
     * @param order       주문 엔티티
     * @param itemSummary "도서명 x수량, ..." 형식의 주문 상품 요약
     * @return 관리자 주문 응답 DTO
     */
    public static AdminOrderResponseDto from(OrderEntity order, String itemSummary) {
        return new AdminOrderResponseDto(
                order.getId(),
                order.getUser().getId(),
                order.getUser().getName(),
                order.getUser().getEmail(),
                order.getTotalPrice(),
                order.getStatus(),
                order.getAddress(),
                order.getOrderedAt(),
                order.getCreatedAt(),
                itemSummary
        );
    }
}
