package com.aimentor.domain.subscription;

import com.aimentor.common.ApiResponse;
import com.aimentor.common.payment.PaymentResultRequestDto;
import com.aimentor.domain.subscription.dto.SubscriptionCreateRequestDto;
import com.aimentor.domain.subscription.dto.SubscriptionResponseDto;
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
 * 구독 API 컨트롤러입니다.
 *
 * [핵심 흐름]
 * 1. 결제 준비용 구독 생성
 * 2. 결제 결과 반영
 * 3. 현재 구독 / 특정 구독 / 구독 이력 조회
 */
@RestController
@RequestMapping("/api/subscriptions")
@RequiredArgsConstructor
public class SubscriptionController {

    private final SubscriptionService subscriptionService;

    /**
     * 결제 준비 단계의 구독을 생성합니다.
     */
    @PostMapping
    public ResponseEntity<ApiResponse<SubscriptionResponseDto>> createSubscription(
            @Valid @RequestBody SubscriptionCreateRequestDto request,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        SubscriptionResponseDto response = subscriptionService.createSubscription(userDetails.getUsername(), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(response));
    }

    /**
     * PortOne 결제를 서버사이드에서 검증하고 구독을 ACTIVE로 확정합니다.
     *
     * [흐름]
     * 프론트 SDK 결제 완료 → paymentId 전송 → PortOne API 직접 조회 → 금액·상태 검증 → 구독 활성화
     */
    @PostMapping("/{id}/verify-payment")
    public ResponseEntity<ApiResponse<SubscriptionResponseDto>> verifyPayment(
            @PathVariable Long id,
            @Valid @RequestBody PortOneVerifyRequestDto request,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                subscriptionService.verifyAndConfirmPayment(userDetails.getUsername(), id, request.paymentId())
        ));
    }

    /**
     * 결제 결과를 구독에 반영합니다.
     */
    @PatchMapping("/{id}/payment")
    public ResponseEntity<ApiResponse<SubscriptionResponseDto>> applyPaymentResult(
            @PathVariable Long id,
            @Valid @RequestBody PaymentResultRequestDto request,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                subscriptionService.applyPaymentResult(userDetails.getUsername(), id, request)
        ));
    }

    /**
     * 현재 사용자에게 보여 줄 대표 구독을 조회합니다.
     */
    @GetMapping("/me")
    public ResponseEntity<ApiResponse<SubscriptionResponseDto>> getMySubscription(
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                subscriptionService.getMyLatestSubscription(userDetails.getUsername())
        ));
    }

    /**
     * 특정 구독 상세를 조회합니다.
     */
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<SubscriptionResponseDto>> getSubscriptionDetail(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                subscriptionService.getSubscriptionDetail(userDetails.getUsername(), id)
        ));
    }

    /**
     * 구독 이력을 조회합니다.
     */
    @GetMapping
    public ResponseEntity<ApiResponse<List<SubscriptionResponseDto>>> getMySubscriptions(
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                subscriptionService.getMySubscriptions(userDetails.getUsername())
        ));
    }
}
