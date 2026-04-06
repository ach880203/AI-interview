package com.aimentor.domain.book.dto;

import com.aimentor.domain.book.CartItemEntity;

/**
 * 장바구니 항목 응답 DTO
 * 도서 정보(title, price)를 함께 포함하여 프론트엔드에서 별도 조회 불필요
 */
public record CartItemResponseDto(
        Long cartItemId,
        Long bookId,
        String bookTitle,
        String bookAuthor,
        String coverUrl,
        int price,         // 현재 도서 가격 (주문 시 스냅샷됨)
        int quantity,
        int subtotal       // price * quantity
) {
    public static CartItemResponseDto of(CartItemEntity item, BookResponseDto book) {
        return new CartItemResponseDto(
                item.getId(),
                book.id(),
                book.title(),
                book.author(),
                book.coverUrl(),
                book.price(),
                item.getQuantity(),
                book.price() * item.getQuantity()
        );
    }
}
