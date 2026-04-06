import api from './axios';

/**
 * 고객센터 문의 API 모음입니다.
 *
 * [역할]
 * 사용자 문의 등록/조회와 관리자 답변 저장을 한 파일로 묶어
 * 고객센터 관련 네트워크 요청 경계를 명확하게 유지합니다.
 */

/**
 * 로그인한 사용자의 문의 목록을 조회합니다.
 */
export const getMyCustomerCenterInquiries = () => api.get('/api/support/inquiries');

/**
 * 고객센터 문의를 새로 등록합니다.
 *
 * @param {{ title: string, content: string }} body 문의 등록 요청 본문
 */
export const createCustomerCenterInquiry = (body) =>
  api.post('/api/support/inquiries', body);

/**
 * 로그인한 사용자가 자신의 문의를 삭제합니다.
 *
 * @param {number} inquiryId 문의 ID
 */
export const deleteMyCustomerCenterInquiry = (inquiryId) =>
  api.delete(`/api/support/inquiries/${inquiryId}`);

/**
 * 관리자 화면에서 전체 문의 목록을 조회합니다.
 */
export const getAdminCustomerCenterInquiries = () => api.get('/api/admin/inquiries');

/**
 * 관리자 답변을 저장합니다.
 *
 * @param {number} inquiryId 문의 ID
 * @param {{ reply: string }} body 답변 요청 본문
 */
export const replyAdminCustomerCenterInquiry = (inquiryId, body) =>
  api.patch(`/api/admin/inquiries/${inquiryId}/reply`, body);

/**
 * 관리자 화면에서 공개 문의를 비밀글로 전환합니다.
 *
 * [주의]
 * 운영자가 노출 중단만 할 수 있도록 "공개 → 비밀" 단방향만 제공합니다.
 *
 * @param {number} inquiryId 문의 ID
 */
export const makeAdminCustomerCenterInquiryPrivate = (inquiryId) =>
  api.patch(`/api/admin/inquiries/${inquiryId}/make-private`);

/**
 * 고객센터 FAQ 목록을 조회합니다.
 * 사용자 화면은 이 API를 기준으로 FAQ를 보여줘야 관리자 수정 내용이 바로 반영됩니다.
 */
export const getCustomerCenterFaqs = () => api.get('/api/support/faqs');

/**
 * 관리자 화면에서 전체 FAQ 목록을 조회합니다.
 */
export const getAdminCustomerCenterFaqs = () => api.get('/api/admin/faqs');

/**
 * 관리자 화면에서 FAQ를 새로 등록합니다.
 *
 * @param {{ category: string, question: string, answer: string }} body FAQ 등록 요청 본문
 */
export const createAdminCustomerCenterFaq = (body) =>
  api.post('/api/admin/faqs', body);

/**
 * 관리자 화면에서 FAQ를 수정합니다.
 *
 * @param {number} faqId FAQ ID
 * @param {{ category: string, question: string, answer: string }} body FAQ 수정 요청 본문
 */
export const updateAdminCustomerCenterFaq = (faqId, body) =>
  api.patch(`/api/admin/faqs/${faqId}`, body);

/**
 * 관리자 화면에서 FAQ를 삭제합니다.
 *
 * [주의]
 * 삭제는 되돌리기보다 다시 등록하는 흐름으로 처리되므로, 삭제 대상 ID를 명확하게 전달합니다.
 *
 * @param {number} faqId FAQ ID
 */
export const deleteAdminCustomerCenterFaq = (faqId) =>
  api.delete(`/api/admin/faqs/${faqId}`);

/**
 * 공개 문의 페이징 조회 (비로그인도 가능)
 *
 * @param {number} page 페이지 번호 (0부터)
 * @param {number} size 페이지 크기
 */
export const getPublicInquiries = (page = 0, size = 5) =>
  api.get(`/api/support/inquiries/public?page=${page}&size=${size}`);

/**
 * 문의 도움됨 카운트 증가
 *
 * @param {number} inquiryId 문의 ID
 */
export const incrementInquiryHelpful = (inquiryId) =>
  api.post(`/api/support/inquiries/${inquiryId}/helpful`);
