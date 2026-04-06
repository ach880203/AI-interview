package com.aimentor.domain.book;

import com.aimentor.domain.user.UserEntity;
import jakarta.persistence.*;
import lombok.*;

/**
 * 장바구니 항목 엔티티 (cart_items 테이블)
 *
 * 설계:
 * - 1 사용자 + 1 도서 = 1 항목 (unique 제약)
 *   → 같은 도서 다시 추가 시 수량만 증가
 * - bookId는 Long으로 저장 (FK 없이 경량 설계)
 *   → 조회 시 BookService를 통해 book 정보 fetch
 */
@Entity
@Table(
    name = "cart_items",
    uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "book_id"})
)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class CartItemEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private UserEntity user;

    @Column(name = "book_id", nullable = false)
    private Long bookId;

    @Column(nullable = false)
    private int quantity;

    /** 수량 변경 */
    public void updateQuantity(int quantity) {
        this.quantity = quantity;
    }
}
