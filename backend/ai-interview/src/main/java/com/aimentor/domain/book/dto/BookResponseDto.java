package com.aimentor.domain.book.dto;

import com.aimentor.domain.book.BookEntity;

import java.time.LocalDateTime;

/**
 * 도서 응답 DTO
 * GET /api/books, GET /api/books/{id} 응답에서 사용
 */
public record BookResponseDto(
        Long id,
        String title,
        String author,
        String publisher,
        int price,
        int stock,
        String coverUrl,
        String description,
        LocalDateTime createdAt
) {
    public static BookResponseDto from(BookEntity book) {
        return new BookResponseDto(
                book.getId(),
                book.getTitle(),
                book.getAuthor(),
                book.getPublisher(),
                book.getPrice(),
                book.getStock(),
                book.getCoverUrl(),
                book.getDescription(),
                book.getCreatedAt()
        );
    }
}
