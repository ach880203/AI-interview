package com.aimentor.domain.admin.dto;

import java.time.LocalDate;

/**
 * 특정 날짜/기간의 매출 상세 응답 DTO입니다.
 *
 * [역할]
 * 매출관리 탭에서 달력으로 날짜를 선택했을 때,
 * 해당 기간의 구독/도서/환불 매출을 각각 분리해 보여줍니다.
 */
public record AdminRevenueDateResponseDto(

        /** 조회 시작 날짜 */
        LocalDate startDate,

        /** 조회 종료 날짜 */
        LocalDate endDate,

        /** 해당 기간 구독 매출 */
        long subscriptionSales,

        /** 해당 기간 도서 매출 */
        long bookSales,

        /** 해당 기간 환불/취소 금액 */
        long refundTotal,

        /** 해당 기간 총 매출 (구독 + 도서 - 환불) */
        long totalSales

) {}
