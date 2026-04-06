package com.aimentor.domain.admin.dto;

/**
 * 관리자 대시보드 통계 응답 DTO
 *
 * [역할]
 * GET /api/admin/dashboard 응답에 사용합니다.
 * 플랫폼 전반의 핵심 수치를 한눈에 볼 수 있게 요약합니다.
 */
public record AdminDashboardResponseDto(

        /** 전체 회원 수 */
        long totalUsers,

        /** 등록된 도서 수 */
        long totalBooks,

        /** 전체 주문 수 */
        long totalOrders,

        /** 처리 대기 중인 주문 수 (PENDING 상태) */
        long pendingOrders,

        /** 재고 부족 도서 수 (stock <= 5) */
        long lowStockBooks,

        /** 관리자 계정 수 */
        long adminUsers,

        /** 전체 매출 합계 (원 단위) */
        long totalSales

) {}
