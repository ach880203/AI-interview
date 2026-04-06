package com.aimentor.domain.book;

import com.aimentor.common.ApiResponse;
import com.aimentor.domain.book.dto.WishlistResponseDto;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 도서 찜(위시리스트) API 컨트롤러입니다.
 */
@RestController
@RequestMapping("/api/wishlist")
@RequiredArgsConstructor
public class WishlistController {

    private final WishlistService wishlistService;

    /** 찜 토글 (추가/제거) */
    @PostMapping("/{bookId}")
    public ResponseEntity<ApiResponse<Map<String, Boolean>>> toggleWishlist(
            @PathVariable Long bookId,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        boolean wishlisted = wishlistService.toggleWishlist(bookId, userDetails.getUsername());
        return ResponseEntity.ok(ApiResponse.success(Map.of("wishlisted", wishlisted)));
    }

    /** 내 찜 목록 조회 */
    @GetMapping
    public ResponseEntity<ApiResponse<List<WishlistResponseDto>>> getMyWishlist(
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                wishlistService.getMyWishlist(userDetails.getUsername())
        ));
    }

    /** 내 찜 도서 ID 목록 (도서 목록 화면 하트 표시용) */
    @GetMapping("/book-ids")
    public ResponseEntity<ApiResponse<List<Long>>> getMyWishlistBookIds(
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                wishlistService.getMyWishlistBookIds(userDetails.getUsername())
        ));
    }
}
