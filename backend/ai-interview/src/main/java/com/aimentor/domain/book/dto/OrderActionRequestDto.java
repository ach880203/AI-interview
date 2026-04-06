package com.aimentor.domain.book.dto;

/**
 * 주문 후속 액션 요청 DTO
 *
 * [역할]
 * 주문 취소(PATCH /api/orders/{id}/cancel) 또는
 * 환불 요청(PATCH /api/orders/{id}/refund-request) 요청 본문에 사용합니다.
 *
 * [reason 필드]
 * 취소/환불 사유를 기록합니다.
 * 관리자가 주문 상태 이력을 확인할 때 참고합니다.
 */
public record OrderActionRequestDto(

        /**
         * 취소/환불 요청 사유.
         * 기록 목적이므로 비워도 되지만, 최소한 이유를 남기도록 권장합니다.
         */
        String reason

) {}
