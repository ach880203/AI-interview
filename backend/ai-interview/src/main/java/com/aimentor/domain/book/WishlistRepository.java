package com.aimentor.domain.book;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

/**
 * 도서 찜(위시리스트) 저장소입니다.
 */
public interface WishlistRepository extends JpaRepository<WishlistEntity, Long> {

    List<WishlistEntity> findAllByUserIdOrderByCreatedAtDesc(Long userId);

    Optional<WishlistEntity> findByUserIdAndBookId(Long userId, Long bookId);

    boolean existsByUserIdAndBookId(Long userId, Long bookId);

    List<WishlistEntity> findAllByUserId(Long userId);
}
