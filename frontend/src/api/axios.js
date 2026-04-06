import axios from 'axios';
import useAuthStore from '../store/authStore';

/**
 * 공용 Axios 인스턴스
 * - baseURL : 환경변수 VITE_API_BASE_URL 우선, 없으면 localhost:8080
 * - timeout : 10초 (AI 서버 경유 요청 대비)
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080',
  timeout: 10000,
});

// ── 요청 인터셉터 ──────────────────────────────────────────────
// 모든 요청에 accessToken을 Authorization 헤더로 자동 추가
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().accessToken;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── 응답 인터셉터 ──────────────────────────────────────────────
// 401 수신 시 refreshToken으로 accessToken 갱신 후 원본 요청 재시도
// 갱신 실패(refreshToken 만료 등) 시 로그인 페이지로 이동

let isRefreshing = false;
// 갱신 중에 들어온 요청들을 대기시키고, 갱신 완료 후 일괄 처리
let failedQueue = [];

function processQueue(error, token = null) {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  failedQueue = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // 401이 아니거나 이미 재시도한 요청이면 바로 reject
    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    // 다른 요청이 이미 갱신 중이면 큐에 넣고 대기
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then((token) => {
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return api(originalRequest);
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    // refreshAccessToken: 새 accessToken + refreshToken(Rotation)을 authStore에 함께 저장
    const { refreshAccessToken, clearAuth } = useAuthStore.getState();

    try {
      // authStore의 refreshAccessToken()을 재사용하여 Rotation 처리를 한 곳에서 관리
      const newAccessToken = await refreshAccessToken();

      processQueue(null, newAccessToken);

      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
      return api(originalRequest);
    } catch (err) {
      // refreshToken도 만료 → 인증 초기화 후 로그인 페이지로 이동
      processQueue(err, null);
      clearAuth();
      window.location.href = '/auth/login';
      return Promise.reject(err);
    } finally {
      isRefreshing = false;
    }
  }
);

export default api;
