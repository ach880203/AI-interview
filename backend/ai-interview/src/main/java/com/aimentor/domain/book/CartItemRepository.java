package com.aimentor.domain.book;

import com.aimentor.domain.user.UserEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

/**
 * 장바구니 JPA 리포지토리
 */
public interface CartItemRepository extends JpaRepository<CartItemEntity, Long> {

    /** 사용자의 장바구니 전체 조회 */
    List<CartItemEntity> findByUser(UserEntity user);

    /** 사용자 + 도서 ID로 항목 조회 (중복 추가 여부 확인) */
    Optional<CartItemEntity> findByUserAndBookId(UserEntity user, Long bookId);

    /** 장바구니 항목 삭제 */
    void deleteByUserAndBookId(UserEntity user, Long bookId);

    /** 주문 완료 후 사용자 장바구니 전체 비우기 */
    void deleteByUser(UserEntity user);
}
