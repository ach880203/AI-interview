package com.aimentor.domain.admin.dto;

import com.aimentor.domain.book.OrderEntity;
import jakarta.validation.constraints.NotNull;

/**
 * 관리자 주문 상태 변경 요청 DTO
 *
 * [역할]
 * PATCH /api/admin/orders/{id}/status 요청 본문에 사용합니다.
 * 관리자가 주문 상태를 직접 변경할 때(예: 배송 완료 처리) 사용합니다.
 */
public record AdminOrderStatusUpdateRequestDto(

        /**
         * 변경할 주문 상태.
         * PENDING / PAID / SHIPPING / DELIVERED / CANCELLED / REFUND_REQUESTED / REFUNDED 중 하나
         */
        @NotNull
        OrderEntity.OrderStatus status,

        /** 상태 변경 사유 (선택 입력) */
        String reason

) {}
