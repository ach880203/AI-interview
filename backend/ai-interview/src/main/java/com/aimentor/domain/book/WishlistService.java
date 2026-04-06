package com.aimentor.domain.book;

import com.aimentor.common.BusinessException;
import com.aimentor.common.ErrorCode;
import com.aimentor.domain.book.dto.WishlistResponseDto;
import com.aimentor.domain.user.UserEntity;
import com.aimentor.domain.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * 도서 찜(위시리스트) 서비스입니다.
 *
 * [역할]
 * 찜 토글(추가/제거), 내 찜 목록 조회, 특정 도서 찜 여부 확인을 담당합니다.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class WishlistService {

    private final WishlistRepository wishlistRepository;
    private final BookRepository bookRepository;
    private final UserRepository userRepository;

    /**
     * 찜 토글 — 이미 찜한 도서면 제거, 아니면 추가합니다.
     * @return true면 찜 추가됨, false면 찜 해제됨
     */
    @Transactional
    public boolean toggleWishlist(Long bookId, String email) {
        UserEntity user = getUser(email);
        BookEntity book = bookRepository.findById(bookId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));

        return wishlistRepository.findByUserIdAndBookId(user.getId(), book.getId())
                .map(existing -> {
                    wishlistRepository.delete(existing);
                    return false;
                })
                .orElseGet(() -> {
                    wishlistRepository.save(WishlistEntity.builder()
                            .user(user)
                            .book(book)
                            .build());
                    return true;
                });
    }

    /** 내 찜 목록 조회 */
    public List<WishlistResponseDto> getMyWishlist(String email) {
        UserEntity user = getUser(email);
        return wishlistRepository.findAllByUserIdOrderByCreatedAtDesc(user.getId())
                .stream()
                .map(WishlistResponseDto::from)
                .toList();
    }

    /** 특정 도서 찜 여부 확인 */
    public boolean isWishlisted(Long bookId, String email) {
        UserEntity user = getUser(email);
        return wishlistRepository.existsByUserIdAndBookId(user.getId(), bookId);
    }

    /** 내 찜 도서 ID 목록 (도서 목록 화면에서 하트 표시용) */
    public List<Long> getMyWishlistBookIds(String email) {
        UserEntity user = getUser(email);
        return wishlistRepository.findAllByUserId(user.getId())
                .stream()
                .map(w -> w.getBook().getId())
                .toList();
    }

    private UserEntity getUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));
    }
}
