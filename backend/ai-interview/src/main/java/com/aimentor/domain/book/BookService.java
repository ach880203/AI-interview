package com.aimentor.domain.book;

import com.aimentor.common.BusinessException;
import com.aimentor.common.ErrorCode;
import com.aimentor.domain.book.dto.BookCreateRequestDto;
import com.aimentor.domain.book.dto.BookResponseDto;
import com.aimentor.domain.book.dto.BookUpdateRequestDto;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * 도서 비즈니스 로직 서비스
 *
 * 공개 API: 목록 조회, 상세 조회 (비회원 허용)
 * ADMIN API: 등록, 수정, 삭제
 * 내부 API: 재고 감소 (OrderService에서 호출)
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class BookService {

    private final BookRepository bookRepository;

    // ──────────────────────────────────────────────────
    // 공개 API (비회원 허용)
    // ──────────────────────────────────────────────────

    /**
     * 도서 목록 조회 (검색 + 페이징)
     * @param keyword 검색어 (null이면 전체 조회)
     * @param pageable 페이지 정보 (기본: page=0, size=20, sort=createdAt,desc)
     */
    public Page<BookResponseDto> getBooks(String keyword, Pageable pageable) {
        return bookRepository.searchBooks(keyword, pageable)
                .map(BookResponseDto::from);
    }

    /** 도서 단건 조회 */
    public BookResponseDto getBook(Long bookId) {
        return BookResponseDto.from(findEntityById(bookId));
    }

    /**
     * 여러 도서를 한 번에 조회합니다.
     *
     * [이유]
     * 주문 목록처럼 대표 상품명을 여러 건 동시에 보여줄 때
     * 도서를 하나씩 조회하면 불필요한 반복 조회가 생겨서 배치 조회를 따로 둡니다.
     */
    public List<BookEntity> findBooksByIds(List<Long> bookIds) {
        if (bookIds == null || bookIds.isEmpty()) {
            return List.of();
        }

        return bookRepository.findAllById(bookIds);
    }

    // ──────────────────────────────────────────────────
    // ADMIN 전용 API
    // ──────────────────────────────────────────────────

    /** 도서 등록 (ADMIN) */
    @Transactional
    public BookResponseDto createBook(BookCreateRequestDto request) {
        BookEntity book = BookEntity.builder()
                .title(request.title())
                .author(request.author())
                .publisher(request.publisher())
                .price(request.price())
                .stock(request.stock())
                .coverUrl(request.coverUrl())
                .description(request.description())
                .build();
        return BookResponseDto.from(bookRepository.save(book));
    }

    /** 도서 수정 (ADMIN) */
    @Transactional
    public BookResponseDto updateBook(Long bookId, BookUpdateRequestDto request) {
        BookEntity book = findEntityById(bookId);
        book.update(request.title(), request.author(), request.publisher(),
                    request.price(), request.coverUrl(), request.description());
        return BookResponseDto.from(book);
    }

    /** 도서 삭제 (ADMIN) */
    @Transactional
    public void deleteBook(Long bookId) {
        BookEntity book = findEntityById(bookId);
        bookRepository.delete(book);
    }

    // ──────────────────────────────────────────────────
    // 내부 사용 (OrderService, CartService에서 호출)
    // ──────────────────────────────────────────────────

    /**
     * 재고 감소 (주문 생성 시 호출)
     * 재고 부족이면 OUT_OF_STOCK 예외
     */
    @Transactional
    public void decreaseStock(Long bookId, int quantity) {
        BookEntity book = findEntityById(bookId);
        if (book.getStock() < quantity) {
            throw new BusinessException(ErrorCode.OUT_OF_STOCK);
        }
        book.decreaseStock(quantity);
    }

    /**
     * 재고 증가 (주문 취소/환불 완료 시 호출)
     *
     * [의도]
     * 결제가 끝난 뒤 주문이 취소되거나 환불이 승인되면
     * 차감했던 재고를 다시 복구해야 실제 재고와 화면 재고가 어긋나지 않습니다.
     */
    @Transactional
    public void increaseStock(Long bookId, int quantity) {
        BookEntity book = findEntityById(bookId);
        book.increaseStock(quantity);
    }

    /** 엔티티 직접 조회 (서비스 내부 / 패키지 내부 사용) */
    BookEntity findEntityById(Long bookId) {
        return bookRepository.findById(bookId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
    }
}
