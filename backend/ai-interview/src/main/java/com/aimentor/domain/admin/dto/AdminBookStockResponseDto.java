package com.aimentor.domain.admin.dto;

import com.aimentor.domain.book.BookEntity;

import java.time.LocalDateTime;

/**
 * 관리자 재고 현황 응답 DTO입니다.
 *
 * [역할]
 * 도서 제목, 가격, 재고 수량을 관리자 화면에서 바로 표시하고 수정할 때 사용합니다.
 */
public record AdminBookStockResponseDto(
        Long id,
        String title,
        String author,
        int price,
        int stock,
        LocalDateTime createdAt
) {

    /**
     * 도서 엔티티를 관리자 재고 응답 DTO로 변환합니다.
     *
     * @param book 도서 엔티티
     * @return 관리자 재고 응답 DTO
     */
    public static AdminBookStockResponseDto from(BookEntity book) {
        return new AdminBookStockResponseDto(
                book.getId(),
                book.getTitle(),
                book.getAuthor(),
                book.getPrice(),
                book.getStock(),
                book.getCreatedAt()
        );
    }
}
