package com.aimentor.domain.book;

import com.aimentor.common.BaseTimeEntity;
import jakarta.persistence.*;
import lombok.*;

/**
 * 도서 엔티티 (books 테이블)
 * 취업 관련 도서 판매 도메인
 * stock: 재고 수량, 0이면 OUT_OF_STOCK 예외 발생
 */
@Entity
@Table(name = "books")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class BookEntity extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(nullable = false, length = 100)
    private String author;

    @Column(length = 100)
    private String publisher; // 출판사

    @Column(nullable = false)
    private int price;

    @Column(nullable = false)
    private int stock; // 재고 수량

    @Column(name = "cover_url")
    private String coverUrl; // 표지 이미지 URL (S3)

    @Column(columnDefinition = "TEXT")
    private String description;

    /** 도서 정보 수정 (ADMIN) */
    public void update(String title, String author, String publisher,
                       int price, String coverUrl, String description) {
        this.title = title;
        this.author = author;
        this.publisher = publisher;
        this.price = price;
        this.coverUrl = coverUrl;
        this.description = description;
    }

    /** 재고 감소 (주문 시 호출) */
    public void decreaseStock(int quantity) {
        this.stock -= quantity;
    }

    /** 재고 증가 (관리자 재고 조정) */
    public void increaseStock(int quantity) {
        this.stock += quantity;
    }

    /**
     * 재고를 목표 수량으로 직접 변경합니다.
     *
     * [역할]
     * 관리자 화면에서 현재 재고를 특정 값으로 바로 맞출 때 사용합니다.
     * 증가/감소 차이를 따로 계산하지 않아도 되므로 관리용 수정 API에 적합합니다.
     *
     * @param stock 변경할 최종 재고 수량
     */
    public void updateStock(int stock) {
        this.stock = stock;
    }
}
