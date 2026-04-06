package com.aimentor.domain.book;

import com.aimentor.common.BaseTimeEntity;
import com.aimentor.domain.user.UserEntity;
import jakarta.persistence.*;
import lombok.*;

/**
 * 도서 찜(위시리스트) 엔티티입니다.
 *
 * [역할]
 * 사용자가 관심 있는 도서를 찜 목록에 추가/제거할 수 있도록 합니다.
 * user + book 조합에 유니크 제약을 걸어 중복 찜을 방지합니다.
 */
@Entity
@Table(
    name = "wishlists",
    uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "book_id"})
)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class WishlistEntity extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private UserEntity user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "book_id", nullable = false)
    private BookEntity book;
}
