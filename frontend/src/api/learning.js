import api from './axios';

/**
 * 학습 관련 API 모음입니다.
 *
 * [역할]
 * 학습 과목 조회, 문제 생성, 답안 채점, 학습 통계 조회 요청을 한곳에 모아 둡니다.
 */

/**
 * 학습 과목 목록을 조회합니다.
 *
 * @returns {Promise} Axios 응답 Promise
 */
export const getSubjects = () => api.get('/api/learning/subjects');

/**
 * 특정 과목 기준으로 AI 학습 문제를 생성합니다.
 *
 * [timeout 120초 설정 이유]
 * GPT-4o로 8~10문제를 생성할 때 재시도·폴백 포함 최대 120초가 소요될 수 있습니다.
 * 전역 Axios 인스턴스의 10초 타임아웃을 이 요청에 한해 120초로 덮어씁니다.
 *
 * @param {number} subjectId 과목 ID
 * @param {{ difficulty: string, count: number, type: string }} body 문제 생성 요청 본문
 * @returns {Promise} Axios 응답 Promise
 */
export const generateProblems = (subjectId, body) =>
  api.post(`/api/learning/subjects/${subjectId}/problems/generate`, body, {
    timeout: 120000,
  });

/**
 * 사용자의 답안을 제출하고 채점 결과를 받습니다.
 *
 * [주의]
 * subjectId, difficulty, problemType는 학습 통계 저장 품질을 높이기 위해 함께 전송합니다.
 *
 * @param {{
 *   subjectId?: number,
 *   difficulty?: string,
 *   problemType?: string,
 *   question: string,
 *   correctAnswer: string,
 *   userAnswer: string,
 *   explanation?: string
 * }} body 답안 제출 요청 본문
 * @returns {Promise} Axios 응답 Promise
 */
export const submitAttempt = (body) => api.post('/api/learning/attempts', body);

/**
 * 같은 학습 세션 키로 저장된 결과를 다시 조회합니다.
 *
 * [사용 이유]
 * 학습 결과 화면은 같은 라우트 안에서 그려지기 때문에
 * 새로고침이 일어나면 프런트 state가 사라질 수 있습니다.
 * 이 API는 그때 백엔드 저장값으로 결과를 복원합니다.
 *
 * @param {string} sessionKey 학습 세션 키
 * @returns {Promise} Axios 응답 Promise
 */
export const getSessionResult = (sessionKey) =>
  api.get(`/api/learning/sessions/${sessionKey}`);

/**
 * 현재 로그인한 사용자의 학습 통계를 조회합니다.
 *
 * @returns {Promise} Axios 응답 Promise
 */
export const getStats = () => api.get('/api/learning/stats');

/**
 * 현재 로그인한 사용자의 오답 목록을 조회합니다.
 *
 * @returns {Promise} Axios 응답 Promise
 */
export const getWrongAttempts = () => api.get('/api/learning/attempts/wrong');

/**
 * 카테고리(과목)별 학습 약점 분석 결과를 조회합니다.
 *
 * @returns {Promise} Axios 응답 Promise — { categories: [{ name, totalCount, correctCount, accuracy, isWeak }] }
 */
export const getAnalytics = () => api.get('/api/learning/analytics');

/**
 * 맞춤 학습 과목 추천 결과를 조회합니다.
 *
 * @returns {Promise} Axios 응답 Promise — { subjectId, subjectName, difficulty, currentAccuracy, reason }
 */
export const getRecommendation = () => api.get('/api/learning/recommendations');
