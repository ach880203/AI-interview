import api from './axios';

/**
 * 도서, 장바구니, 주문 API 모음입니다.
 *
 * [의도]
 * 화면에서는 URL 문자열을 직접 다루지 않고,
 * "무엇을 요청하는지"가 이름만 봐도 보이도록 함수로 감쌉니다.
 */

/**
 * 도서 목록을 조회합니다.
 */
export const getBooks = (params = {}) => api.get('/api/books', { params });

/**
 * 도서 상세를 조회합니다.
 */
export const getBook = (id) => api.get(`/api/books/${id}`);

/**
 * 관리자 도서를 등록합니다.
 */
export const createBook = (body) => api.post('/api/books', body);

/**
 * 관리자 도서를 수정합니다.
 */
export const updateBook = (id, body) => api.put(`/api/books/${id}`, body);

/**
 * 관리자 도서를 삭제합니다.
 */
export const deleteBook = (id) => api.delete(`/api/books/${id}`);

/**
 * 도서 표지 이미지를 업로드합니다. (ADMIN 전용)
 * @param {File} file - 이미지 파일 (최대 20MB)
 * @returns {{ url: string }} 업로드된 이미지 URL
 */
export const uploadBookCover = (file) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post('/api/books/upload-cover', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 30000,
  });
};

/**
 * 내 장바구니를 조회합니다.
 */
export const getCart = () => api.get('/api/cart');

/**
 * 장바구니에 책을 담습니다.
 */
export const addToCart = (body) => api.post('/api/cart', body);

/**
 * 장바구니 수량을 수정합니다.
 */
export const updateCartItem = (bookId, body) => api.put(`/api/cart/${bookId}`, body);

/**
 * 장바구니 항목을 삭제합니다.
 */
export const removeFromCart = (bookId) => api.delete(`/api/cart/${bookId}`);

/**
 * 주문을 결제 대기 상태로 생성합니다.
 *
 * [중요]
 * 이제 이 API는 주문을 바로 완료시키지 않습니다.
 * 프런트는 응답으로 받은 주문 ID를 가지고 결제 결과 화면으로 이동한 뒤,
 * 별도의 결제 결과 반영 API를 다시 호출해야 합니다.
 */
export const createOrder = (body) => api.post('/api/orders', body);

/**
 * 주문 결제 결과를 반영합니다. (모의 결제 전용)
 *
 * @param {number} orderId
 * @param {{ resultType: 'APPROVED' | 'FAILED' | 'CANCELLED', reason?: string }} body
 */
export const applyOrderPaymentResult = (orderId, body) =>
  api.patch(`/api/orders/${orderId}/payment`, body);

/**
 * PortOne 결제를 서버사이드에서 검증합니다.
 *
 * [흐름]
 * 프론트 SDK로 결제 완료 → paymentId를 서버에 전송
 * → 서버가 PortOne API 직접 조회 → 금액·상태 검증 → PAID 확정
 *
 * @param {number} orderId
 * @param {{ paymentId: string }} body - PortOne SDK가 사용한 결제 ID
 */
export const verifyOrderPayment = (orderId, body) =>
  api.post(`/api/orders/${orderId}/verify-payment`, body);

/**
 * 내 주문 목록을 조회합니다.
 */
export const getOrders = () => api.get('/api/orders');

/**
 * 주문 상세를 조회합니다.
 */
export const getOrderDetail = (id) => api.get(`/api/orders/${id}`);

/**
 * 주문을 취소합니다.
 */
export const cancelOrder = (id, body = {}) => api.patch(`/api/orders/${id}/cancel`, body);

/**
 * 환불을 요청합니다.
 */
export const requestOrderRefund = (id, body = {}) =>
  api.patch(`/api/orders/${id}/refund-request`, body);

/**
 * 구매 확정을 처리합니다.
 */
export const confirmOrderPurchase = (id, body = {}) =>
  api.patch(`/api/orders/${id}/purchase-confirm`, body);
