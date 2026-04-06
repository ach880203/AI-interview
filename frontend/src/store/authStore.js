import axios from 'axios';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * 인증 전역 상태 스토어 (Zustand v5 + persist 미들웨어)
 *
 * [상태]
 *   accessToken  : JWT 액세스 토큰 (30분 만료) — 메모리에만 보관하여 XSS 위험 최소화
 *   refreshToken : JWT 리프레시 토큰 (7일 만료) — localStorage에 보관하여 새로고침 후에도 유지
 *   user         : 로그인한 사용자 정보 { id, email, name, role }
 *
 * [액션]
 *   login()              : 이메일/비밀번호로 로그인, 토큰·사용자 정보 상태에 저장
 *   logout()             : 서버 로그아웃 API 호출 후 모든 인증 상태 초기화
 *   refreshAccessToken() : refreshToken으로 새 accessToken 발급 (axios 인터셉터에서 호출)
 *
 * [주의] 이 파일은 api/axios.js가 의존(useAuthStore.getState())하므로
 *        api/axios.js 인스턴스를 임포트하면 순환 의존성이 발생합니다.
 *        따라서 axios 원본을 직접 사용합니다.
 */

/** Spring Boot 백엔드 기본 URL — 환경변수로 교체 가능 */
const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

/**
 * 새로고침 직후 여러 보호 페이지가 동시에 인증 복구를 시도하지 않도록
 * 현재 진행 중인 복구 Promise를 모듈 범위에서 공유합니다.
 */
let accessTokenRestorePromise = null;

const useAuthStore = create(
  persist(
    (set, get) => ({
      // ── 상태 ────────────────────────────────────────────────
      accessToken: null,
      refreshToken: null,
      user: null,

      // ── 액션 ────────────────────────────────────────────────

      /**
       * 로그인 액션
       * POST /api/auth/login 호출 → 응답에서 토큰과 사용자 정보를 추출하여 상태에 저장
       * @param {string} email    - 사용자 이메일
       * @param {string} password - 비밀번호
       * @returns {object} API 응답 data.data (accessToken, refreshToken 포함)
       * @throws  {Error}  서버 오류 또는 인증 실패 시
       */
      login: async (email, password) => {
        const { data } = await axios.post(`${BASE_URL}/api/auth/login`, {
          email,
          password,
        });
        const { accessToken, refreshToken, ...userData } = data.data;

        set({
          accessToken,
          refreshToken,
          // 서버가 로그인 응답에 user 객체를 포함하면 바로 저장,
          // 없으면 null로 초기화 (이후 /api/auth/me 별도 호출)
          user: userData.user ?? null,
        });

        return data.data;
      },

      /**
       * 로그아웃 액션
       * 서버에 로그아웃 요청 후 (실패해도) 로컬 인증 상태를 모두 초기화합니다.
       * accessToken이 없으면 서버 API 호출 없이 로컬 상태만 초기화합니다.
       */
      logout: async () => {
        const { accessToken } = get();
        try {
          if (accessToken) {
            await axios.post(
              `${BASE_URL}/api/auth/logout`,
              {},
              { headers: { Authorization: `Bearer ${accessToken}` } }
            );
          }
        } finally {
          // 서버 오류와 무관하게 로컬 상태는 반드시 초기화
          set({ accessToken: null, refreshToken: null, user: null });
        }
      },

      /**
       * 액세스 토큰 갱신 액션
       * POST /api/auth/refresh 호출 → 새 accessToken을 상태에 저장 후 반환
       * api/axios.js 응답 인터셉터에서 401 수신 시 호출됩니다.
       * @returns {string} 새로 발급된 accessToken
       * @throws  {Error}  refreshToken이 없거나 만료된 경우
       */
      refreshAccessToken: async () => {
        const { refreshToken } = get();
        if (!refreshToken) throw new Error('리프레시 토큰이 없습니다.');

        const { data } = await axios.post(`${BASE_URL}/api/auth/refresh`, {
          refreshToken,
        });
        const newAccessToken = data.data.accessToken;
        const newRefreshToken = data.data.refreshToken;
        // Refresh Token Rotation: 서버가 새 refreshToken을 발급하므로 함께 저장
        // 저장하지 않으면 다음 새로고침 때 이미 무효화된 옛 토큰을 사용하게 됨
        set({ accessToken: newAccessToken, refreshToken: newRefreshToken });
        return newAccessToken;
      },

      // ── 단순 세터 (외부에서 직접 상태를 주입해야 할 때 사용) ──

      /** 사용자 정보 저장 — /api/auth/me 응답 후 컴포넌트에서 호출 */
      setUser: (user) => set({ user }),

      /** 토큰 직접 주입 — 테스트 또는 소셜 로그인 콜백 처리 시 사용 */
      setTokens: (accessToken, refreshToken) =>
        set({ accessToken, refreshToken }),

      /** accessToken만 교체 — axios 인터셉터 내부에서 사용 */
      setAccessToken: (accessToken) => set({ accessToken }),

      /**
       * 새로고침 직후 accessToken이 비어 있으면
       * 보호 페이지 렌더링 전에 refreshToken으로 accessToken을 복구합니다.
       */
      restoreAccessToken: async () => {
        const { accessToken, refreshToken, clearAuth } = get();

        if (accessToken) return accessToken;
        if (!refreshToken) return null;

        if (!accessTokenRestorePromise) {
          accessTokenRestorePromise = axios
            .post(`${BASE_URL}/api/auth/refresh`, {
              refreshToken,
            })
            .then(({ data }) => {
              const newAccessToken = data.data.accessToken;
              const newRefreshToken = data.data.refreshToken;

              set({
                accessToken: newAccessToken,
                refreshToken: newRefreshToken,
              });

              return newAccessToken;
            })
            .catch((error) => {
              clearAuth();
              throw error;
            })
            .finally(() => {
              accessTokenRestorePromise = null;
            });
        }

        return accessTokenRestorePromise;
      },

      /**
       * 인증 상태 즉시 초기화 (서버 API 호출 없음)
       * axios 응답 인터셉터에서 refreshToken 갱신 실패 시 호출됩니다.
       * logout()은 서버 요청을 포함하므로, 토큰이 이미 만료된 상황에서는
       * 이 메서드로 로컬 상태만 정리하고 로그인 페이지로 이동합니다.
       */
      clearAuth: () => set({ accessToken: null, refreshToken: null, user: null }),
    }),
    {
      name: 'auth-storage', // localStorage 키 이름

      // accessToken은 만료가 짧으므로 localStorage에 저장하지 않음
      // 새로고침 시 refreshToken으로 재발급받는 흐름을 유지
      partialize: (state) => ({
        refreshToken: state.refreshToken,
        user: state.user,
      }),
    }
  )
);

export default useAuthStore;
