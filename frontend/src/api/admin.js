import api from './axios';

/**
 * 관리자 전용 API 모음입니다.
 *
 * [역할]
 * 관리자 화면에서 필요한 회원, 재고, 주문, 요약 통계 요청을 한곳에 모읍니다.
 */

/**
 * 관리자 대시보드 요약 통계를 조회합니다.
 *
 * @returns {Promise} Axios 응답 Promise
 */
export const getAdminDashboard = () => api.get('/api/admin/dashboard');

/**
 * 회원 목록을 조회합니다.
 *
 * @returns {Promise} Axios 응답 Promise
 */
export const getAdminUsers = () => api.get('/api/admin/users');

/**
 * 특정 사용자의 권한을 변경합니다.
 *
 * @param {number} userId 사용자 ID
 * @param {{ role: 'USER' | 'ADMIN' }} body 권한 변경 요청 본문
 * @returns {Promise} Axios 응답 Promise
 */
export const updateAdminUserRole = (userId, body) =>
  api.put(`/api/admin/users/${userId}/role`, body);

/**
 * 도서 재고 현황을 조회합니다.
 *
 * @returns {Promise} Axios 응답 Promise
 */
export const getAdminBookStocks = () => api.get('/api/admin/books/stock');

/**
 * 특정 도서 재고를 수정합니다.
 *
 * @param {number} bookId 도서 ID
 * @param {{ stock: number }} body 재고 수정 요청 본문
 * @returns {Promise} Axios 응답 Promise
 */
export const updateAdminBookStock = (bookId, body) =>
  api.patch(`/api/admin/books/${bookId}/stock`, body);

/**
 * 전체 주문 목록을 조회합니다.
 *
 * @returns {Promise} Axios 응답 Promise
 */
export const getAdminOrders = () => api.get('/api/admin/orders');

/**
 * 특정 주문의 상태를 변경합니다.
 *
 * @param {number} orderId 주문 ID
 * @param {{ status: 'PENDING' | 'PAID' | 'SHIPPED' | 'DELIVERED' | 'REFUNDED' | 'CANCELLED', reason?: string }} body 상태 변경 요청 본문
 * @returns {Promise} Axios 응답 Promise
 */
export const updateAdminOrderStatus = (orderId, body) =>
  api.patch(`/api/admin/orders/${orderId}/status`, body);

/**
 * 매출 통계를 조회합니다 (구독/도서/환불/일/월/연).
 *
 * @returns {Promise} Axios 응답 Promise
 */
export const getAdminRevenue = () => api.get('/api/admin/revenue');

/**
 * 특정 기간의 매출 상세를 조회합니다.
 *
 * @param {string} startDate 시작 날짜 (yyyy-MM-dd)
 * @param {string} endDate 종료 날짜 (yyyy-MM-dd)
 * @returns {Promise} Axios 응답 Promise
 */
export const getAdminRevenueByDate = (startDate, endDate) =>
  api.get('/api/admin/revenue/by-date', { params: { startDate, endDate } });
