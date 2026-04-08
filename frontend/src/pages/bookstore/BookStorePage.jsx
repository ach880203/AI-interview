import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import * as bookApi from '../../api/book';
import * as learningApi from '../../api/learning';
import * as wishlistApi from '../../api/wishlist';
import useCartStore from '../../store/cartStore';
import useAuthStore from '../../store/authStore';

/**
 * 도서 판매 페이지입니다.
 *
 * [역할]
 * 학습 과목과 연결된 추천 서적을 큐레이션 형태로 보여 주고 장바구니로 연결합니다.
 *
 * [의도]
 * 단순 상품 목록보다 "지금 공부 중인 과목에 맞는 책"이라는 맥락이 있어야
 * 이 프로젝트의 학습-커머스 연결 구조를 설명하기 좋습니다.
 */
export default function BookStorePage() {
  const incrementCart = useCartStore((state) => state.incrementCart);
  const user = useAuthStore((state) => state.user);

  const [books, setBooks] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [pagination, setPagination] = useState({ totalPages: 0, number: 0 });
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(0);
  const [selectedBook, setSelectedBook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [addingId, setAddingId] = useState(null);
  const [toast, setToast] = useState(null);
  const debounceRef = useRef(null);

  // 찜 상태
  const [wishlistIds, setWishlistIds] = useState(new Set());
  const [togglingWishId, setTogglingWishId] = useState(null);

  /**
   * 도서 목록과 과목 목록을 불러옵니다.
   */
  const fetchBookStoreData = useCallback(async (nextKeyword, nextPage) => {
    setLoading(true);
    setError('');

    try {
      const [bookResult, subjectResult] = await Promise.all([
        bookApi.getBooks({
          page: nextPage,
          size: 12,
          ...(nextKeyword ? { keyword: nextKeyword } : {}),
        }),
        learningApi.getSubjects(),
      ]);

      const pageData = bookResult.data.data;
      setBooks(pageData?.content ?? []);
      setPagination({
        totalPages: pageData?.totalPages ?? 0,
        number: pageData?.number ?? 0,
      });
      setSubjects(subjectResult.data.data ?? []);
    } catch (requestError) {
      setBooks([]);
      setError(
        requestError.response?.data?.error?.message ??
          '도서 목록을 불러오지 못했습니다.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBookStoreData(keyword, page);
  }, [fetchBookStoreData, keyword, page]);

  // 로그인 상태일 때 찜 목록 로드
  useEffect(() => {
    setWishlistIds(new Set());
    if (!user?.email) {
      return;
    }
    wishlistApi.getMyWishlistBookIds()
      .then((res) => setWishlistIds(new Set(res.data.data ?? [])))
      .catch(() => {});
  }, [user?.email]);

  async function handleToggleWishlist(bookId, event) {
    event.stopPropagation();
    if (!user?.email) {
      showToast('로그인 후 찜 기능을 사용할 수 있습니다.', true);
      return;
    }
    setTogglingWishId(bookId);
    try {
      const res = await wishlistApi.toggleWishlist(bookId);
      const wishlisted = res.data.data?.wishlisted;
      setWishlistIds((prev) => {
        const next = new Set(prev);
        if (wishlisted) next.add(bookId);
        else next.delete(bookId);
        return next;
      });
      showToast(wishlisted ? '찜 목록에 추가했습니다.' : '찜 목록에서 제거했습니다.');
    } catch {
      showToast('찜 처리에 실패했습니다.', true);
    } finally {
      setTogglingWishId(null);
    }
  }

  /**
   * 검색 입력을 디바운스로 처리합니다.
   */
  function handleSearch(event) {
    const value = event.target.value;
    setKeyword(value);
    setPage(0);

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchBookStoreData(value, 0);
    }, 300);
  }

  /**
   * 장바구니에 책을 추가합니다.
   */
  async function handleAddToCart(book, event) {
    event.stopPropagation();
    setAddingId(book.id);

    try {
      await bookApi.addToCart({ bookId: book.id, quantity: 1 });
      incrementCart();
      showToast(`"${book.title}"을 장바구니에 담았습니다.`);
      if (selectedBook?.id === book.id) {
        setSelectedBook(null);
      }
    } catch (requestError) {
      showToast(
        requestError.response?.data?.error?.message ??
          '장바구니 담기에 실패했습니다.',
        true
      );
    } finally {
      setAddingId(null);
    }
  }

  /**
   * 하단 알림 메시지를 띄웁니다.
   */
  function showToast(message, isError = false) {
    setToast({ message, isError });
    window.clearTimeout(showToast.timeoutId);
    showToast.timeoutId = window.setTimeout(() => setToast(null), 3000);
  }

  /**
   * 학습 과목과 책 제목/설명을 매칭해 추천 섹션을 만듭니다.
   */
  const curatedShelves = useMemo(() => {
    return subjects
      .map((subject) => {
        const matchedBooks = books.filter((book) => {
          const searchableText = `${book.title} ${book.description ?? ''}`.toLowerCase();
          return searchableText.includes(subject.name.toLowerCase());
        });

        return {
          subject,
          books: matchedBooks,
        };
      })
      .filter((shelf) => shelf.books.length > 0)
      .slice(0, 4);
  }, [books, subjects]);

  return (
    /* 전체 배경 — mentor-bg */
    <div className="min-h-screen bg-mentor-bg">
      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* 헤더 — 밝은 그라디언트, 어두운 배경 제거 */}
        <section className="rounded-[32px] bg-gradient-to-br from-white via-mentor-sky-light to-mentor-warm border border-mentor-border px-7 py-8 shadow-[var(--shadow-card)]">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_320px]">
            <div>
              <p className="text-sm font-semibold text-mentor-primary">도서 스토어</p>
              <h1 className="mt-3 text-3xl font-bold leading-tight text-mentor-text">
                학습 과목과 연결된 실전 서적을 바로 고르세요.
              </h1>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  to="/cart"
                  className="rounded-full bg-mentor-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-mentor-primary-dark"
                >
                  장바구니 보기
                </Link>
                <Link
                  to="/orders"
                  className="rounded-full border border-mentor-border bg-mentor-surface px-4 py-2 text-sm font-semibold text-mentor-text transition hover:border-mentor-primary hover:text-mentor-primary"
                >
                  주문내역 보기
                </Link>
              </div>
            </div>

            {/* 검색 패널 — 흰색 반투명 카드 */}
            <div className="rounded-3xl bg-white/70 p-5 border border-mentor-border backdrop-blur-sm">
              <p className="text-sm font-semibold text-mentor-text">빠른 검색</p>
              <div className="mt-4 relative">
                <input
                  type="text"
                  value={keyword}
                  onChange={handleSearch}
                  placeholder="도서 제목 또는 과목 키워드를 검색하세요."
                  className="w-full rounded-2xl border border-mentor-border bg-mentor-surface px-4 py-3 text-sm text-mentor-text placeholder:text-mentor-muted outline-none transition focus:border-mentor-primary"
                />
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <StoreStat label="전체 도서" value={books.length} />
                <StoreStat label="연결 과목" value={subjects.length} />
              </div>
            </div>
          </div>
        </section>

        {curatedShelves.length > 0 && (
          <section className="mt-8 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-mentor-text">과목별 추천 서가</h2>
                <p className="mt-1 text-sm text-mentor-muted">
                  학습 과목과 직접 연결되는 도서를 먼저 보여 줍니다.
                </p>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {curatedShelves.map((shelf) => (
                <article key={shelf.subject.id} className="rounded-3xl bg-mentor-surface p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-mentor-primary">{shelf.subject.name}</p>
                      <p className="mt-1 text-sm text-mentor-muted">{shelf.subject.description}</p>
                    </div>
                    <span className="rounded-full bg-mentor-bg px-3 py-1 text-xs font-semibold text-mentor-muted">
                      {shelf.books.length}권
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {shelf.books.slice(0, 2).map((book) => (
                      <MiniBookCard
                        key={book.id}
                        book={book}
                        onSelect={() => setSelectedBook(book)}
                        onAddToCart={handleAddToCart}
                        isAdding={addingId === book.id}
                        isWishlisted={wishlistIds.has(book.id)}
                        onToggleWishlist={handleToggleWishlist}
                        isTogglingWish={togglingWishId === book.id}
                      />
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        <section className="mt-8">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-mentor-text">전체 판매 서적</h2>
              <p className="mt-1 text-sm text-mentor-muted">
                현재 프로젝트 분위기에 맞춰 차분한 톤의 카드형 서가로 구성했습니다.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-24">
              <span className="h-10 w-10 animate-spin rounded-full border-4 border-mentor-accent border-t-mentor-primary" />
            </div>
          ) : error ? (
            <div className="rounded-3xl bg-mentor-surface px-6 py-16 text-center shadow-sm">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          ) : books.length === 0 ? (
            <div className="rounded-3xl bg-mentor-surface px-6 py-16 text-center shadow-sm">
              <p className="text-sm text-mentor-muted">검색 결과가 없습니다.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
              {books.map((book) => (
                <BookCard
                  key={book.id}
                  book={book}
                  onSelect={() => setSelectedBook(book)}
                  onAddToCart={handleAddToCart}
                  isAdding={addingId === book.id}
                  isWishlisted={wishlistIds.has(book.id)}
                  onToggleWishlist={handleToggleWishlist}
                  isTogglingWish={togglingWishId === book.id}
                />
              ))}
            </div>
          )}
        </section>

        {pagination.totalPages > 1 && (
          <Pagination
            current={pagination.number}
            total={pagination.totalPages}
            onChange={setPage}
          />
        )}
      </div>

      {selectedBook && (
        <BookDetailModal
          book={selectedBook}
          isAdding={addingId === selectedBook.id}
          onClose={() => setSelectedBook(null)}
          onAddToCart={handleAddToCart}
        />
      )}

      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-2xl px-5 py-3 text-sm font-semibold text-white shadow-lg ${
            toast.isError ? 'bg-red-500' : 'bg-mentor-primary'
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}

/**
 * 상단 요약 타일입니다.
 */
/**
 * 검색 패널 내 통계 타일 — 밝은 배경에 맞게 mentor 토큰 사용
 */
function StoreStat({ label, value }) {
  return (
    <div className="rounded-2xl bg-mentor-accent/60 px-4 py-4">
      <p className="text-xs text-mentor-muted">{label}</p>
      <p className="mt-2 text-2xl font-bold text-mentor-primary">{value}</p>
    </div>
  );
}

/**
 * 추천 서가용 작은 도서 카드입니다.
 */
/**
 * 추천 서가용 작은 도서 카드 — mentor 토큰 색상
 */
function MiniBookCard({ book, onSelect, onAddToCart, isAdding, isWishlisted, onToggleWishlist, isTogglingWish }) {
  return (
    <div
      className="relative rounded-2xl border border-mentor-border p-4 text-left transition hover:border-mentor-primary hover:bg-mentor-accent/40"
    >
      <div className="absolute top-2 right-2">
        <WishlistHeart
          isWishlisted={isWishlisted}
          isToggling={isTogglingWish}
          onClick={(e) => onToggleWishlist(book.id, e)}
          small
        />
      </div>
      <button type="button" onClick={onSelect} className="w-full text-left">
        <p className="line-clamp-2 text-sm font-semibold text-mentor-text">{book.title}</p>
        <p className="mt-1 text-xs text-mentor-muted">{book.author}</p>
        <p className="mt-3 text-sm font-bold text-mentor-primary">{book.price.toLocaleString('ko-KR')}원</p>
      </button>
      <button
        type="button"
        onClick={(event) => onAddToCart(book, event)}
        disabled={isAdding || book.stock === 0}
        className="mt-3 w-full rounded-xl bg-mentor-primary px-3 py-2 text-xs font-semibold text-white transition hover:bg-mentor-primary-dark disabled:cursor-not-allowed disabled:bg-mentor-bg disabled:text-mentor-muted"
      >
        {isAdding ? '담는 중...' : book.stock === 0 ? '품절' : '장바구니 담기'}
      </button>
    </div>
  );
}

/**
 * 일반 도서 카드입니다.
 */
function BookCard({ book, onSelect, onAddToCart, isAdding, isWishlisted, onToggleWishlist, isTogglingWish }) {
  return (
    <article
      onClick={onSelect}
      className="group cursor-pointer overflow-hidden rounded-[28px] bg-mentor-surface shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-mentor-bg">
        {book.coverUrl ? (
          <img
            src={book.coverUrl}
            alt={book.title}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-mentor-accent to-mentor-bg">
            <span className="text-5xl text-mentor-muted">책</span>
          </div>
        )}
        <WishlistHeart
          isWishlisted={isWishlisted}
          isToggling={isTogglingWish}
          onClick={(e) => onToggleWishlist(book.id, e)}
        />
      </div>

      <div className="p-4">
        <p className="line-clamp-2 text-sm font-semibold leading-6 text-mentor-text">{book.title}</p>
        <p className="mt-1 text-xs text-mentor-muted">{book.author}</p>
        <p className="mt-3 text-lg font-bold text-mentor-primary">{book.price.toLocaleString('ko-KR')}원</p>
        <button
          type="button"
          onClick={(event) => onAddToCart(book, event)}
          disabled={isAdding || book.stock === 0}
          className="mt-3 w-full rounded-2xl bg-mentor-accent px-4 py-2.5 text-sm font-semibold text-mentor-primary transition hover:bg-mentor-primary/10 disabled:cursor-not-allowed disabled:bg-mentor-bg disabled:text-mentor-muted"
        >
          {isAdding ? '담는 중...' : book.stock === 0 ? '품절' : '장바구니 담기'}
        </button>
      </div>
    </article>
  );
}

/**
 * 도서 상세 모달입니다.
 */
function BookDetailModal({ book, isAdding, onClose, onAddToCart }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl overflow-hidden rounded-[32px] bg-mentor-surface shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="grid gap-6 p-6 md:grid-cols-[260px_minmax(0,1fr)]">
          <div className="overflow-hidden rounded-[24px] bg-mentor-bg">
            {book.coverUrl ? (
              <img src={book.coverUrl} alt={book.title} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full min-h-[340px] items-center justify-center bg-gradient-to-br from-mentor-accent to-mentor-bg">
                <span className="text-6xl text-mentor-muted">책</span>
              </div>
            )}
          </div>

          <div className="flex flex-col">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-mentor-primary">{book.publisher || '추천 도서'}</p>
                <h2 className="mt-2 text-2xl font-bold leading-9 text-mentor-text">{book.title}</h2>
                <p className="mt-2 text-sm text-mentor-muted">{book.author}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full bg-mentor-bg px-3 py-1 text-sm font-semibold text-mentor-muted transition hover:bg-mentor-border"
              >
                닫기
              </button>
            </div>

            <div className="mt-5 rounded-3xl bg-mentor-bg p-5">
              <div className="grid gap-3 sm:grid-cols-3">
                <InfoTile label="판매가" value={`${book.price.toLocaleString('ko-KR')}원`} />
                <InfoTile label="재고" value={book.stock > 0 ? `${book.stock}권` : '품절'} />
                <InfoTile label="상태" value={book.stock > 0 ? '주문 가능' : '입고 대기'} />
              </div>
            </div>

            <div className="mt-5 flex-1 rounded-3xl border border-mentor-border p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-mentor-muted">도서 소개</p>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-mentor-muted">
                {book.description || '도서 소개가 아직 등록되지 않았습니다.'}
              </p>
            </div>

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-2xl border border-mentor-border px-4 py-3 text-sm font-semibold text-mentor-muted transition hover:bg-mentor-bg"
              >
                닫기
              </button>
              <button
                type="button"
                onClick={(event) => onAddToCart(book, event)}
                disabled={isAdding || book.stock === 0}
                className="flex-1 rounded-2xl bg-mentor-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-mentor-primary-dark disabled:cursor-not-allowed disabled:bg-mentor-bg disabled:text-mentor-muted"
              >
                {isAdding ? '담는 중...' : book.stock === 0 ? '품절' : '장바구니 담기'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 상세 모달 내부 정보 타일입니다.
 */
function InfoTile({ label, value }) {
  return (
    <div className="rounded-2xl bg-mentor-surface px-4 py-4">
      <p className="text-xs text-mentor-muted">{label}</p>
      <p className="mt-2 text-sm font-semibold text-mentor-text">{value}</p>
    </div>
  );
}

/**
 * 페이지네이션입니다.
 */
function Pagination({ current, total, onChange }) {
  const maxVisible = 5;
  let start = Math.max(0, current - Math.floor(maxVisible / 2));
  let end = start + maxVisible;

  if (end > total) {
    end = total;
    start = Math.max(0, end - maxVisible);
  }

  const pages = Array.from({ length: end - start }, (_, index) => start + index);

  return (
    <div className="mt-10 flex justify-center gap-2">
      <PageButton disabled={current === 0} onClick={() => onChange(current - 1)}>
        이전
      </PageButton>
      {pages.map((pageNumber) => (
        <PageButton
          key={pageNumber}
          active={pageNumber === current}
          onClick={() => onChange(pageNumber)}
        >
          {pageNumber + 1}
        </PageButton>
      ))}
      <PageButton disabled={current === total - 1} onClick={() => onChange(current + 1)}>
        다음
      </PageButton>
    </div>
  );
}

/**
 * 페이지 버튼입니다.
 */
function PageButton({ children, onClick, active = false, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
        active
          ? 'bg-mentor-primary text-white'
          : 'bg-mentor-surface text-mentor-muted hover:bg-mentor-bg'
      } disabled:cursor-not-allowed disabled:opacity-40`}
    >
      {children}
    </button>
  );
}

/**
 * 찜 하트 버튼입니다.
 */
function WishlistHeart({ isWishlisted, isToggling, onClick, small = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isToggling}
      className={`${
        small ? '' : 'absolute top-3 right-3'
      } z-10 flex items-center justify-center rounded-full bg-white/80 backdrop-blur-sm shadow transition hover:scale-110 disabled:opacity-50 ${
        small ? 'h-7 w-7' : 'h-9 w-9'
      }`}
    >
      <svg
        className={`${small ? 'h-4 w-4' : 'h-5 w-5'} transition-colors`}
        viewBox="0 0 24 24"
        fill={isWishlisted ? '#ef4444' : 'none'}
        stroke={isWishlisted ? '#ef4444' : '#9ca3af'}
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"
        />
      </svg>
    </button>
  );
}
