package com.aimentor.domain.book;

import com.aimentor.common.ApiResponse;
import com.aimentor.common.payment.PaymentResultRequestDto;
import com.aimentor.domain.book.dto.OrderActionRequestDto;
import com.aimentor.domain.book.dto.OrderCreateRequestDto;
import com.aimentor.domain.book.dto.OrderDetailResponseDto;
import com.aimentor.domain.book.dto.OrderResponseDto;
import com.aimentor.external.payment.dto.PortOneVerifyRequestDto;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 주문 API 컨트롤러입니다.
 *
 * [핵심 흐름]
 * 1. 주문 생성 -> PENDING
 * 2. 결제 결과 반영 -> PAID / PAYMENT_FAILED / CANCELLED
 * 3. 이후 배송과 환불 흐름으로 연결
 */
@RestController
@RequestMapping("/api/orders")
@RequiredArgsConstructor
public class OrderController {

    private final OrderService orderService;

    /**
     * 주문을 결제 대기 상태로 생성합니다.
     */
    @PostMapping
    public ResponseEntity<ApiResponse<OrderDetailResponseDto>> createOrder(
            @Valid @RequestBody OrderCreateRequestDto request,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        OrderDetailResponseDto response = orderService.createOrder(userDetails.getUsername(), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(response));
    }

    /**
     * PortOne 결제 검증 후 주문을 PAID로 확정합니다.
     *
     * [흐름]
     * 1. 프론트가 PortOne SDK로 결제 완료 후 paymentId를 전송
     * 2. 백엔드가 PortOne API로 직접 조회 → 금액 + 상태 검증
     * 3. 검증 통과 시 PAID 전환, 실패 시 PAYMENT_FAILED + 재고 복구
     */
    @PostMapping("/{id}/verify-payment")
    public ResponseEntity<ApiResponse<OrderDetailResponseDto>> verifyPayment(
            @PathVariable Long id,
            @Valid @RequestBody PortOneVerifyRequestDto request,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                orderService.verifyAndConfirmPayment(userDetails.getUsername(), id, request.paymentId())
        ));
    }

    /**
     * 결제 결과를 주문에 반영합니다.
     *
     * [주의]
     * 실제 PG 콜백 전 단계에서는 프런트의 모의 결제 화면이 이 API를 호출합니다.
     */
    @PatchMapping("/{id}/payment")
    public ResponseEntity<ApiResponse<OrderDetailResponseDto>> applyPaymentResult(
            @PathVariable Long id,
            @Valid @RequestBody PaymentResultRequestDto request,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                orderService.applyPaymentResult(userDetails.getUsername(), id, request)
        ));
    }

    /**
     * 내 주문 목록을 조회합니다.
     */
    @GetMapping
    public ResponseEntity<ApiResponse<List<OrderResponseDto>>> getOrders(
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                orderService.getOrders(userDetails.getUsername())
        ));
    }

    /**
     * 내 주문 상세를 조회합니다.
     */
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<OrderDetailResponseDto>> getOrderDetail(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                orderService.getOrderDetail(userDetails.getUsername(), id)
        ));
    }

    /**
     * 사용자가 주문을 취소합니다.
     */
    @PatchMapping("/{id}/cancel")
    public ResponseEntity<ApiResponse<OrderDetailResponseDto>> cancelOrder(
            @PathVariable Long id,
            @Valid @RequestBody OrderActionRequestDto request,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                orderService.cancelOrder(userDetails.getUsername(), id, request)
        ));
    }

    /**
     * 사용자가 환불을 요청합니다.
     */
    @PatchMapping("/{id}/refund-request")
    public ResponseEntity<ApiResponse<OrderDetailResponseDto>> requestRefund(
            @PathVariable Long id,
            @Valid @RequestBody OrderActionRequestDto request,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                orderService.requestRefund(userDetails.getUsername(), id, request)
        ));
    }

    /**
     * 사용자가 구매 확정을 처리합니다.
     */
    @PatchMapping("/{id}/purchase-confirm")
    public ResponseEntity<ApiResponse<OrderDetailResponseDto>> confirmPurchase(
            @PathVariable Long id,
            @Valid @RequestBody OrderActionRequestDto request,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                orderService.confirmPurchase(userDetails.getUsername(), id, request)
        ));
    }
}
