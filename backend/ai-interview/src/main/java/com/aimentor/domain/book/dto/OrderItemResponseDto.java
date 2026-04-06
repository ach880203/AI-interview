package com.aimentor.domain.book.dto;

import com.aimentor.domain.book.OrderItemEntity;

/**
 * 주문 항목 응답 DTO
 * 주문 시점의 가격 스냅샷을 반환 (현재 도서 가격과 다를 수 있음)
 */
public record OrderItemResponseDto(
        Long id,
        Long bookId,
        String bookTitle,   // 도서 제목 (조회 시점 기준)
        int quantity,
        int price,          // 주문 시점 가격 스냅샷
        int subtotal        // price * quantity
) {
    public static OrderItemResponseDto of(OrderItemEntity item, String bookTitle) {
        return new OrderItemResponseDto(
                item.getId(),
                item.getBookId(),
                bookTitle,
                item.getQuantity(),
                item.getPrice(),
                item.getSubtotal()
        );
    }
}
