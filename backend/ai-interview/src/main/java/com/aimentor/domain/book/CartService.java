package com.aimentor.domain.book;

import com.aimentor.common.BusinessException;
import com.aimentor.common.ErrorCode;
import com.aimentor.domain.book.dto.CartAddRequestDto;
import com.aimentor.domain.book.dto.CartItemResponseDto;
import com.aimentor.domain.book.dto.CartUpdateRequestDto;
import com.aimentor.domain.user.UserEntity;
import com.aimentor.domain.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * 장바구니 비즈니스 로직 서비스
 *
 * 설계:
 * - 같은 도서 추가 시 수량 합산 (중복 추가 방지)
 * - 장바구니 항목 조회 시 BookService로 도서 정보 함께 반환
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CartService {

    private final CartItemRepository cartItemRepository;
    private final BookService bookService;
    private final UserRepository userRepository;

    /** 내 장바구니 조회 */
    public List<CartItemResponseDto> getCart(String email) {
        UserEntity user = getUser(email);
        return cartItemRepository.findByUser(user)
                .stream()
                .map(item -> CartItemResponseDto.of(item, bookService.getBook(item.getBookId())))
                .toList();
    }

    /**
     * 장바구니 항목 추가
     * 이미 담긴 도서라면 수량 합산
     */
    @Transactional
    public CartItemResponseDto addToCart(String email, CartAddRequestDto request) {
        UserEntity user = getUser(email);

        // 도서 존재 여부 확인
        var book = bookService.getBook(request.bookId());

        CartItemEntity item = cartItemRepository
                .findByUserAndBookId(user, request.bookId())
                .map(existing -> {
                    // 이미 담긴 경우: 수량 합산
                    existing.updateQuantity(existing.getQuantity() + request.quantity());
                    return existing;
                })
                .orElseGet(() -> cartItemRepository.save(
                        CartItemEntity.builder()
                                .user(user)
                                .bookId(request.bookId())
                                .quantity(request.quantity())
                                .build()
                ));

        return CartItemResponseDto.of(item, book);
    }

    /**
     * 장바구니 수량 변경
     * PUT /api/cart/{bookId}
     */
    @Transactional
    public CartItemResponseDto updateQuantity(String email, Long bookId, CartUpdateRequestDto request) {
        UserEntity user = getUser(email);

        CartItemEntity item = cartItemRepository.findByUserAndBookId(user, bookId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));

        item.updateQuantity(request.quantity());

        return CartItemResponseDto.of(item, bookService.getBook(bookId));
    }

    /**
     * 장바구니 항목 삭제
     * DELETE /api/cart/{bookId}
     */
    @Transactional
    public void removeFromCart(String email, Long bookId) {
        UserEntity user = getUser(email);
        cartItemRepository.deleteByUserAndBookId(user, bookId);
    }

    private UserEntity getUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));
    }
}
