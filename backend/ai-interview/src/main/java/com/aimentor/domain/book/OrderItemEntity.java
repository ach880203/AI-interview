package com.aimentor.domain.book;

import jakarta.persistence.*;
import lombok.*;

/**
 * 주문 항목 엔티티 (order_items 테이블)
 *
 * 설계:
 * - price: 주문 시점의 도서 가격 스냅샷 (나중에 도서 가격이 변경돼도 영향 없음)
 * - bookId: FK 없이 Long으로 저장 (도서 삭제 시에도 주문 이력 보존)
 */
@Entity
@Table(name = "order_items")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class OrderItemEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id", nullable = false)
    private OrderEntity order;

    /** 도서 ID (FK 없이 저장: 도서 삭제 후에도 주문 이력 보존) */
    @Column(name = "book_id", nullable = false)
    private Long bookId;

    @Column(nullable = false)
    private int quantity;

    /** 주문 시점 가격 스냅샷 (이후 도서 가격 변경에 영향 없음) */
    @Column(nullable = false)
    private int price;

    /** 소계 계산 편의 메서드 */
    public int getSubtotal() {
        return price * quantity;
    }
}
