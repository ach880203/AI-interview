package com.aimentor.domain.book.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

/**
 * 장바구니 추가 요청 DTO
 * POST /api/cart
 */
public record CartAddRequestDto(

        @NotNull(message = "도서 ID는 필수입니다.")
        Long bookId,

        @NotNull(message = "수량은 필수입니다.")
        @Min(value = 1, message = "수량은 1 이상이어야 합니다.")
        Integer quantity
) {}
