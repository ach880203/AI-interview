package com.aimentor.domain.admin.dto;

/**
 * 관리자 매출 통계 응답 DTO입니다.
 *
 * [역할]
 * 구독 매출, 도서 매출, 환불/취소 금액, 일/월/연 매출을
 * 프론트 대시보드 위젯과 매출관리 탭에 제공합니다.
 *
 * [시간 기준]
 * - dailySales: 당일 자정 기준 초기화
 * - monthlySales: 매월 1일 0시 기준 초기화
 * - yearlySales: 매년 1월 1일 0시 기준 초기화
 */
public record AdminRevenueResponseDto(

        /** 구독 매출 합계 (ACTIVE + EXPIRED 상태) */
        long subscriptionSales,

        /** 도서 판매 매출 합계 (PAID ~ PURCHASE_CONFIRMED 상태) */
        long bookSales,

        /** 환불/취소 금액 합계 (REFUNDED + CANCELLED 상태) */
        long refundTotal,

        /** 오늘 매출 (자정 기준 초기화) */
        long dailySales,

        /** 이번 달 매출 (1일 0시 기준 초기화) */
        long monthlySales,

        /** 올해 매출 (1월 1일 0시 기준 초기화) */
        long yearlySales

) {}
