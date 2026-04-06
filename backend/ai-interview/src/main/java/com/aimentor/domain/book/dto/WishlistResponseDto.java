package com.aimentor.domain.book.dto;

import com.aimentor.domain.book.WishlistEntity;

import java.time.LocalDateTime;

/**
 * 찜 목록 응답 DTO입니다.
 * 도서 정보를 함께 포함하여 프런트에서 별도 조회 없이 바로 표시할 수 있게 합니다.
 */
public record WishlistResponseDto(
        Long id,
        Long bookId,
        String bookTitle,
        String bookAuthor,
        String bookPublisher,
        int bookPrice,
        String bookCoverUrl,
        LocalDateTime createdAt
) {
    public static WishlistResponseDto from(WishlistEntity wishlist) {
        return new WishlistResponseDto(
                wishlist.getId(),
                wishlist.getBook().getId(),
                wishlist.getBook().getTitle(),
                wishlist.getBook().getAuthor(),
                wishlist.getBook().getPublisher(),
                wishlist.getBook().getPrice(),
                wishlist.getBook().getCoverUrl(),
                wishlist.getCreatedAt()
        );
    }
}
