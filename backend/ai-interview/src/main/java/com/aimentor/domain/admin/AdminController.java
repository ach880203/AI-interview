package com.aimentor.domain.admin;

import com.aimentor.common.ApiResponse;
import com.aimentor.domain.admin.dto.*;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

/**
 * 관리자 전용 API 컨트롤러입니다.
 *
 * [역할]
 * 회원 목록, 권한 변경, 재고 현황, 주문 목록, 관리자 대시보드 통계를
 * 프론트 관리자 페이지에 제공하는 진입점입니다.
 *
 * [주의]
 * 실제 권한 검사는 SecurityConfig에서 `/api/admin/**` 경로 전체에
 * `hasRole("ADMIN")`로 적용됩니다.
 */
@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {

    private final AdminService adminService;

    /**
     * 회원 목록을 조회합니다.
     *
     * @return 관리자 회원 목록 응답
     */
    @GetMapping("/users")
    public ResponseEntity<ApiResponse<List<AdminUserResponseDto>>> getUsers() {
        return ResponseEntity.ok(ApiResponse.success(adminService.getUsers()));
    }

    /**
     * 특정 사용자의 권한을 변경합니다.
     *
     * @param id 사용자 ID
     * @param request 권한 변경 요청 DTO
     * @return 변경 후 사용자 정보 응답
     */
    @PutMapping("/users/{id}/role")
    public ResponseEntity<ApiResponse<AdminUserResponseDto>> updateUserRole(
            @PathVariable Long id,
            @Valid @RequestBody AdminUserRoleUpdateRequestDto request) {

        return ResponseEntity.ok(ApiResponse.success(
                adminService.updateUserRole(id, request)
        ));
    }

    /**
     * 도서 재고 현황을 조회합니다.
     *
     * @return 관리자 재고 목록 응답
     */
    @GetMapping("/books/stock")
    public ResponseEntity<ApiResponse<List<AdminBookStockResponseDto>>> getBookStocks() {
        return ResponseEntity.ok(ApiResponse.success(adminService.getBookStocks()));
    }

    /**
     * 특정 도서의 재고를 수정합니다.
     *
     * @param id 도서 ID
     * @param request 재고 수정 요청 DTO
     * @return 변경 후 도서 재고 정보 응답
     */
    @PatchMapping("/books/{id}/stock")
    public ResponseEntity<ApiResponse<AdminBookStockResponseDto>> updateBookStock(
            @PathVariable Long id,
            @Valid @RequestBody AdminBookStockUpdateRequestDto request) {

        return ResponseEntity.ok(ApiResponse.success(
                adminService.updateBookStock(id, request)
        ));
    }

    /**
     * 전체 주문 목록을 조회합니다.
     *
     * @return 관리자 주문 목록 응답
     */
    @GetMapping("/orders")
    public ResponseEntity<ApiResponse<List<AdminOrderResponseDto>>> getOrders() {
        return ResponseEntity.ok(ApiResponse.success(adminService.getOrders()));
    }

    /**
     * 특정 주문의 상태를 변경합니다.
     *
     * @param id 주문 ID
     * @param request 주문 상태 변경 요청 DTO
     * @return 변경 후 주문 정보 응답
     */
    @PatchMapping("/orders/{id}/status")
    public ResponseEntity<ApiResponse<AdminOrderResponseDto>> updateOrderStatus(
            @PathVariable Long id,
            @Valid @RequestBody AdminOrderStatusUpdateRequestDto request) {

        return ResponseEntity.ok(ApiResponse.success(
                adminService.updateOrderStatus(id, request)
        ));
    }

    /**
     * 관리자 대시보드 통계를 조회합니다.
     *
     * @return 관리자 대시보드 요약 통계 응답
     */
    @GetMapping("/dashboard")
    public ResponseEntity<ApiResponse<AdminDashboardResponseDto>> getDashboard() {
        return ResponseEntity.ok(ApiResponse.success(adminService.getDashboard()));
    }

    /**
     * 매출 통계를 조회합니다.
     * 구독/도서/환불/일/월/연 매출을 한번에 반환합니다.
     *
     * @return 매출 통계 응답
     */
    @GetMapping("/revenue")
    public ResponseEntity<ApiResponse<AdminRevenueResponseDto>> getRevenue() {
        return ResponseEntity.ok(ApiResponse.success(adminService.getRevenue()));
    }

    /**
     * 특정 기간의 매출 상세를 조회합니다.
     * 매출관리 탭에서 달력으로 날짜 선택 시 사용합니다.
     *
     * @param startDate 시작 날짜 (yyyy-MM-dd)
     * @param endDate 종료 날짜 (yyyy-MM-dd)
     * @return 기간별 매출 상세 응답
     */
    @GetMapping("/revenue/by-date")
    public ResponseEntity<ApiResponse<AdminRevenueDateResponseDto>> getRevenueByDate(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {

        return ResponseEntity.ok(ApiResponse.success(
                adminService.getRevenueByDate(startDate, endDate)
        ));
    }
}
