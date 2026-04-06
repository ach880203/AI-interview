import api from './axios';

/**
 * 면접 도메인 API 모음
 *
 * 면접 진행 흐름:
 * 1. startSession()  → 세션 생성 + 첫 질문 반환
 * 2. submitAnswer()  → 답변 저장 + 다음 질문 반환 (MAX_QUESTIONS까지 반복)
 * 3. endSession()    → 면접 종료 + 피드백 즉시 반환
 * 4. getFeedback()   → 저장된 피드백 재조회
 */

/**
 * POST /api/interviews/sessions - 면접 세션 시작
 *
 * [timeout 60초 설정 이유]
 * 이력서/자소서/채용공고 본문이 길면 Python AI 서버가 첫 질문을 생성하는 데
 * 10초를 넘길 수 있습니다. 전역 Axios 10초 타임아웃을 그대로 쓰면
 * 서버가 정상 처리 중이어도 프론트가 먼저 실패로 판단할 수 있어 별도 타임아웃을 둡니다.
 *
 * @param {{ resumeId?, coverLetterId?, jobPostingId? }} body - 선택한 문서 ID들
 * @returns {{ sessionId, status, firstQuestion: { id, orderNum, question } }}
 */
export const startSession = (body) =>
  api.post('/api/interviews/sessions', body, { timeout: 60000 });

/**
 * POST /api/interviews/sessions/{id}/answer - 답변 제출
 *
 * [timeout 60초 설정 이유]
 * 답변 제출 후 다음 질문 생성도 AI 서버를 다시 거치므로
 * 문서 컨텍스트와 대화 히스토리가 길면 10초를 넘길 수 있습니다.
 * 첫 질문만 늘리고 여기서 끊기면 사용성은 여전히 깨지므로 동일하게 늘립니다.
 *
 * @param {number} sessionId - 세션 ID
 * @param {{ orderNum: number, answerText: string, audioUrl?: string }} body
 * @returns {{ hasNextQuestion: boolean, nextQuestion?: { id, orderNum, question } }}
 */
export const submitAnswer = (sessionId, body) =>
  api.post(`/api/interviews/sessions/${sessionId}/answer`, body, { timeout: 60000 });

/**
 * POST /api/interviews/sessions/{id}/end - 면접 종료 + 피드백 생성
 * 마지막 답변 제출 후 hasNextQuestion=false일 때 호출
 *
 * [timeout 180초 설정 이유]
 * GPT-4o가 전체 면접 Q&A + Wave 1 보조 점수(태도·STAR·일관성)를 포함해
 * 풍부한 피드백을 생성하는 데 최대 60~120초 소요됩니다.
 * 전역 Axios 인스턴스의 10초 타임아웃을 이 요청에 한해 180초로 덮어씁니다.
 *
 * @param {number} sessionId
 * @returns {FeedbackResponseDto}
 */
// 긴 면접 피드백은 3분 이상 걸릴 수 있어 브라우저 타임아웃도 함께 늘립니다.
export const endSession = (sessionId) =>
  api.post(`/api/interviews/sessions/${sessionId}/end`, null, { timeout: 600000 });

/**
 * GET /api/interviews/sessions/{id}/feedback - 피드백 조회
 * 결과 페이지에서 사용 (면접 종료 후에만 조회 가능)
 * @param {number} sessionId
 * @returns {FeedbackResponseDto}
 */
export const getFeedback = (sessionId) =>
  api.get(`/api/interviews/sessions/${sessionId}/feedback`);

/** GET /api/interviews/sessions - 내 면접 세션 목록 */
export const getSessions = () => api.get('/api/interviews/sessions');

/**
 * GET /api/interviews/sessions/{id} - 세션 상세 + Q&A 전체 조회
 * @param {number} sessionId
 * @returns {SessionDetailResponseDto} { id, status, qaList: [{ id, orderNum, question, answerText }] }
 */
export const getSessionDetail = (sessionId) =>
  api.get(`/api/interviews/sessions/${sessionId}`);

/**
 * POST /api/interviews/sessions/{id}/speech - 음성 파일 → 텍스트 변환 (Whisper STT)
 *
 * [timeout 30초 설정 이유]
 * Whisper API 음성 변환은 파일 크기에 따라 최대 20~30초 소요됩니다.
 * 전역 Axios 인스턴스의 10초 타임아웃을 이 요청에 한해 30초로 덮어씁니다.
 *
 * @param {number} sessionId - 세션 ID
 * @param {Blob} audioBlob - MediaRecorder로 녹음한 음성 Blob
 * @returns {{ text: string }} 변환된 텍스트
 */
export const convertSpeech = (sessionId, audioBlob) => {
  const formData = new FormData();
  formData.append('audio', audioBlob, 'recording.webm');
  return api.post(`/api/interviews/sessions/${sessionId}/speech`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 30000,
  });
};

/** GET /api/interviews/qa-history - 오답노트용 면접 Q&A 전체 이력 */
export const getQaHistory = () => api.get('/api/interviews/qa-history');

/**
 * GET /api/interviews/growth - 면접 회차별 성장 추적
 * 완료된 세션 전체의 점수를 시간 오름차순으로 반환합니다.
 * N+1 없이 단일 쿼리로 차트 데이터를 제공합니다.
 *
 * @returns {GrowthReportDto} { sessions: [{ sessionId, sessionNum, overallScore, logicScore, ... }] }
 */
export const getGrowthReport = () => api.get('/api/interviews/growth');

/**
 * POST /api/interviews/daily-practice - 오늘의 연습질문 답변 평가
 * @param {string} question - 면접 질문
 * @param {string} answer - 사용자 답변
 * @returns {{ score: number, feedback: string }}
 */
export const evaluateDailyPractice = (question, answer) =>
  api.post('/api/interviews/daily-practice', { question, answer }, { timeout: 30000 });

/**
 * POST /api/tts/speak - 텍스트 → MP3 음성 변환 (OpenAI TTS)
 *
 * [역할]
 * 면접 질문 텍스트를 자연스러운 MP3 음성으로 변환합니다.
 * Python AI 서버의 OpenAI TTS(tts-1 모델, nova 음성)를 사용합니다.
 *
 * [timeout 20초 설정 이유]
 * OpenAI TTS API 응답은 평균 1~3초이나 네트워크 상태에 따라 최대 15초 소요됩니다.
 *
 * @param {string} text    - 변환할 텍스트 (면접 질문)
 * @param {string} voice   - 음성 이름 (기본값: 'nova')
 * @returns {Promise<Blob>} MP3 오디오 Blob
 */
export const speakText = (text, voice = 'shimmer') =>
  api.post(
    '/api/tts/speak',
    { text, voice },
    { responseType: 'blob', timeout: 20000 },
  );
