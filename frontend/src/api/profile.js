import api from './axios';

/**
 * 프로필 관련 API 모음입니다.
 *
 * [역할]
 * 이력서, 자기소개서, 채용공고 CRUD 요청을 한곳에 모아 두고
 * 페이지 컴포넌트는 화면 상태와 사용자 상호작용에만 집중할 수 있게 돕습니다.
 */

/**
 * multipart/form-data 본문을 만드는 공용 함수입니다.
 *
 * [동작 방식]
 * 1. `request` 객체를 JSON Blob으로 감싸서 백엔드 `@RequestPart("request")`와 맞춥니다.
 * 2. 파일이 있을 때만 `file` 파트를 추가합니다.
 *
 * @param {object} request 문서 본문 정보
 * @param {File | null} file 첨부 파일
 * @returns {FormData} 업로드용 FormData 객체
 */
function createMultipartPayload(request, file) {
  const formData = new FormData();
  formData.append(
    'request',
    new Blob([JSON.stringify(request)], { type: 'application/json' })
  );

  if (file) {
    formData.append('file', file);
  }

  return formData;
}

/**
 * 내 이력서 목록을 조회합니다.
 *
 * @returns {Promise} Axios 응답 Promise
 */
export const getResumes = () => api.get('/api/resumes');

/**
 * 특정 이력서 상세를 조회합니다.
 *
 * @param {number} id 이력서 ID
 * @returns {Promise} Axios 응답 Promise
 */
export const getResume = (id) => api.get(`/api/resumes/${id}`);

/**
 * 이력서를 등록합니다.
 *
 * @param {object} request 제목/내용
 * @param {File | null} file 첨부 파일
 * @returns {Promise} Axios 응답 Promise
 */
export const createResume = (request, file) =>
  api.post('/api/resumes', createMultipartPayload(request, file));

/**
 * 이력서를 수정합니다.
 *
 * @param {number} id 이력서 ID
 * @param {object} request 제목/내용
 * @param {File | null} file 첨부 파일
 * @returns {Promise} Axios 응답 Promise
 */
export const updateResume = (id, request, file) =>
  api.put(`/api/resumes/${id}`, createMultipartPayload(request, file));

/**
 * 이력서를 삭제합니다.
 *
 * @param {number} id 이력서 ID
 * @returns {Promise} Axios 응답 Promise
 */
export const deleteResume = (id) => api.delete(`/api/resumes/${id}`);

/**
 * 내 자기소개서 목록을 조회합니다.
 *
 * @returns {Promise} Axios 응답 Promise
 */
export const getCoverLetters = () => api.get('/api/cover-letters');

/**
 * 자기소개서를 등록합니다.
 *
 * @param {object} request 제목/내용
 * @param {File | null} file PDF 또는 이미지 파일 (선택)
 * @returns {Promise} Axios 응답 Promise
 */
export const createCoverLetter = (request, file) =>
  api.post('/api/cover-letters', createMultipartPayload(request, file));

/**
 * 자기소개서를 수정합니다.
 *
 * @param {number} id 자기소개서 ID
 * @param {object} request 제목/내용
 * @param {File | null} file PDF 또는 이미지 파일 (선택)
 * @returns {Promise} Axios 응답 Promise
 */
export const updateCoverLetter = (id, request, file) =>
  api.put(`/api/cover-letters/${id}`, createMultipartPayload(request, file));

/**
 * 자기소개서를 삭제합니다.
 *
 * @param {number} id 자기소개서 ID
 * @returns {Promise} Axios 응답 Promise
 */
export const deleteCoverLetter = (id) => api.delete(`/api/cover-letters/${id}`);

/**
 * 내 채용공고 목록을 조회합니다.
 *
 * @returns {Promise} Axios 응답 Promise
 */
export const getJobPostings = () => api.get('/api/job-postings');

/**
 * 채용공고를 등록합니다.
 *
 * @param {object} request 회사/포지션/설명
 * @param {File | null} file 첨부 파일
 * @returns {Promise} Axios 응답 Promise
 */
export const createJobPosting = (request, file) =>
  api.post('/api/job-postings', createMultipartPayload(request, file));

/**
 * 채용공고를 수정합니다.
 *
 * @param {number} id 채용공고 ID
 * @param {object} request 회사/포지션/설명
 * @param {File | null} file 첨부 파일
 * @returns {Promise} Axios 응답 Promise
 */
export const updateJobPosting = (id, request, file) =>
  api.put(`/api/job-postings/${id}`, createMultipartPayload(request, file));

/**
 * 채용공고를 삭제합니다.
 *
 * @param {number} id 채용공고 ID
 * @returns {Promise} Axios 응답 Promise
 */
export const deleteJobPosting = (id) => api.delete(`/api/job-postings/${id}`);

/**
 * URL을 입력하면 AI가 채용 정보를 자동 추출해 등록합니다.
 *
 * [동작 방식]
 * Python AI 서버가 URL HTML을 가져온 뒤 GPT-4o로
 * company / position / description을 파싱해 바로 저장합니다.
 *
 * @param {string} url 채용공고 URL
 * @returns {Promise} Axios 응답 Promise
 */
export const createJobPostingFromUrl = (url) =>
  api.post('/api/job-postings/from-url', { url }, { timeout: 60000 });
