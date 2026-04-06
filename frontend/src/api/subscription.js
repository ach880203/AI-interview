import api from './axios';

/**
 * 구독 API 모음입니다.
 *
 * [의도]
 * 구독 생성, 결제 결과 반영, 현재 구독 조회를 분리해 두면
 * 결제 화면과 완료 화면이 어떤 데이터를 쓰는지 설명하기 쉬워집니다.
 */

/**
 * 현재 사용자에게 대표로 보여 줄 구독 상태를 조회합니다.
 */
export const getMySubscription = () => api.get('/api/subscriptions/me');

/**
 * 특정 구독 상세를 조회합니다.
 */
export const getSubscriptionDetail = (subscriptionId) =>
  api.get(`/api/subscriptions/${subscriptionId}`);

/**
 * 구독 이력을 조회합니다.
 */
export const getMySubscriptionHistory = () => api.get('/api/subscriptions');

/**
 * 결제 준비 단계의 구독을 생성합니다.
 */
export const createSubscription = (payload) => api.post('/api/subscriptions', payload);

/**
 * 구독 결제 결과를 반영합니다.
 *
 * @param {number} subscriptionId
 * @param {{ resultType: 'APPROVED' | 'FAILED' | 'CANCELLED', reason?: string }} payload
 */
export const applySubscriptionPaymentResult = (subscriptionId, payload) =>
  api.patch(`/api/subscriptions/${subscriptionId}/payment`, payload);

/**
 * PortOne 구독 결제를 서버사이드에서 검증합니다.
 *
 * [흐름]
 * 프론트 SDK로 결제 완료 → paymentId를 서버에 전송
 * → 서버가 PortOne API 직접 조회 → 금액·상태 검증 → 구독 ACTIVE 확정
 *
 * @param {number} subscriptionId
 * @param {{ paymentId: string }} body - PortOne SDK가 사용한 결제 ID
 */
export const verifySubscriptionPayment = (subscriptionId, body) =>
  api.post(`/api/subscriptions/${subscriptionId}/verify-payment`, body);
