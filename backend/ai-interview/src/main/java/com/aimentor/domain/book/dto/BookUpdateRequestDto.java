package com.aimentor.domain.book.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * 도서 수정 요청 DTO (ADMIN 전용)
 * PUT /api/books/{id}
 */
public record BookUpdateRequestDto(

        @NotBlank(message = "도서 제목은 필수입니다.")
        @Size(max = 200, message = "제목은 200자 이하여야 합니다.")
        String title,

        @NotBlank(message = "저자는 필수입니다.")
        @Size(max = 100, message = "저자는 100자 이하여야 합니다.")
        String author,

        @Size(max = 100, message = "출판사는 100자 이하여야 합니다.")
        String publisher,

        @NotNull(message = "가격은 필수입니다.")
        @Min(value = 0, message = "가격은 0 이상이어야 합니다.")
        Integer price,

        String coverUrl,
        String description
) {}
