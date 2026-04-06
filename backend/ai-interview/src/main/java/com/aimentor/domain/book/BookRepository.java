package com.aimentor.domain.book;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * 도서 JPA 리포지토리
 */
public interface BookRepository extends JpaRepository<BookEntity, Long> {

    /**
     * 키워드로 도서 검색 (제목 + 저자 + 출판사 대소문자 무시)
     * keyword가 null이면 전체 조회
     */
    @Query("SELECT b FROM BookEntity b WHERE " +
           "(:keyword IS NULL OR " +
           " LOWER(b.title) LIKE LOWER(CONCAT('%', :keyword, '%')) OR " +
           " LOWER(b.author) LIKE LOWER(CONCAT('%', :keyword, '%')) OR " +
           " LOWER(b.publisher) LIKE LOWER(CONCAT('%', :keyword, '%')))")
    Page<BookEntity> searchBooks(@Param("keyword") String keyword, Pageable pageable);
}
