import api from './axios';

/**
 * 도서 찜(위시리스트) API 모음입니다.
 */

/** 찜 토글 (추가/제거) */
export const toggleWishlist = (bookId) =>
  api.post(`/api/wishlist/${bookId}`);

/** 내 찜 목록 조회 */
export const getMyWishlist = () =>
  api.get('/api/wishlist');

/** 내 찜 도서 ID 목록 (하트 표시용) */
export const getMyWishlistBookIds = () =>
  api.get('/api/wishlist/book-ids');
