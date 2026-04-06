package com.aimentor.domain.admin.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

/**
 * 관리자 도서 재고 수정 요청 DTO
 *
 * [역할]
 * PATCH /api/admin/books/{id}/stock 요청 본문에 사용합니다.
 */
public record AdminBookStockUpdateRequestDto(

        /** 변경할 재고 수량 (0 이상) */
        @NotNull
        @Min(0)
        Integer stock

) {}
