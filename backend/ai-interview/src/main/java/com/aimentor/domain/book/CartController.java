package com.aimentor.domain.book;

import com.aimentor.common.ApiResponse;
import com.aimentor.domain.book.dto.CartAddRequestDto;
import com.aimentor.domain.book.dto.CartItemResponseDto;
import com.aimentor.domain.book.dto.CartUpdateRequestDto;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 장바구니 API 컨트롤러
 * 기본 경로: /api/cart
 * 모든 엔드포인트 🔒 JWT 인증 필요
 */
@RestController
@RequestMapping("/api/cart")
@RequiredArgsConstructor
public class CartController {

    private final CartService cartService;

    /**
     * GET /api/cart - 장바구니 전체 조회
     * 응답: 항목별 도서 정보(title, price) + 수량 + 소계 포함
     */
    @GetMapping
    public ResponseEntity<ApiResponse<List<CartItemResponseDto>>> getCart(
            @AuthenticationPrincipal UserDetails userDetails) {

        return ResponseEntity.ok(ApiResponse.success(
                cartService.getCart(userDetails.getUsername())));
    }

    /**
     * POST /api/cart - 장바구니 항목 추가
     * 이미 담긴 도서 → 수량 합산
     * 요청: { "bookId": 1, "quantity": 2 }
     */
    @PostMapping
    public ResponseEntity<ApiResponse<CartItemResponseDto>> addToCart(
            @Valid @RequestBody CartAddRequestDto request,
            @AuthenticationPrincipal UserDetails userDetails) {

        CartItemResponseDto response = cartService.addToCart(userDetails.getUsername(), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(response));
    }

    /**
     * PUT /api/cart/{bookId} - 수량 변경
     * 요청: { "quantity": 3 }
     */
    @PutMapping("/{bookId}")
    public ResponseEntity<ApiResponse<CartItemResponseDto>> updateQuantity(
            @PathVariable Long bookId,
            @Valid @RequestBody CartUpdateRequestDto request,
            @AuthenticationPrincipal UserDetails userDetails) {

        return ResponseEntity.ok(ApiResponse.success(
                cartService.updateQuantity(userDetails.getUsername(), bookId, request)));
    }

    /**
     * DELETE /api/cart/{bookId} - 장바구니 항목 삭제
     */
    @DeleteMapping("/{bookId}")
    public ResponseEntity<ApiResponse<Void>> removeFromCart(
            @PathVariable Long bookId,
            @AuthenticationPrincipal UserDetails userDetails) {

        cartService.removeFromCart(userDetails.getUsername(), bookId);
        return ResponseEntity.ok(ApiResponse.success());
    }
}
