import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * 장바구니 전역 상태 스토어입니다.
 *
 * [역할]
 * 네비게이션 바의 장바구니 배지 숫자를 전역으로 공유하고,
 * 새로고침 후에도 같은 사용자의 숫자가 유지되도록 localStorage에 저장합니다.
 *
 * [주의]
 * 예전에는 브라우저 하나당 장바구니 개수 1개만 저장해서
 * 계정을 바꿔 로그인해도 이전 사용자의 숫자가 그대로 남아 보였습니다.
 * 지금은 사용자별로 개수를 분리 저장하고, 현재 로그인 사용자에 맞는 값만 꺼내 씁니다.
 */
const useCartStore = create(
  persist(
    (set) => ({
      // 현재 화면에 보여 줄 장바구니 개수
      cartCount: 0,

      // 현재 어떤 사용자 영역을 보고 있는지 저장합니다.
      activeUserKey: 'anonymous',

      // 사용자별 장바구니 배지 숫자 저장소입니다.
      cartCountByUser: {},

      /**
       * 현재 로그인 사용자를 기준으로 저장 영역을 전환합니다.
       *
       * [이유]
       * 같은 브라우저에서 A 계정, B 계정이 번갈아 로그인할 수 있으므로
       * 계정 전환 시 이전 사용자의 장바구니 개수가 따라오지 않게 막아야 합니다.
       */
      setActiveUser: (userKey) =>
        set((state) => {
          const nextUserKey = userKey || 'anonymous';
          return {
            activeUserKey: nextUserKey,
            cartCount: state.cartCountByUser[nextUserKey] ?? 0,
          };
        }),

      /**
       * 서버에서 실제 장바구니 목록을 받은 뒤 개수를 동기화합니다.
       * @param {number} n - 서버에서 받은 cartItems 배열 길이
       */
      setCartCount: (n) =>
        set((state) => {
          const safeCount = Math.max(0, n);
          return {
            cartCount: safeCount,
            cartCountByUser: {
              ...state.cartCountByUser,
              [state.activeUserKey]: safeCount,
            },
          };
        }),

      /**
       * 장바구니 담기 성공 시 즉시 +1 반영합니다.
       */
      incrementCart: () =>
        set((state) => {
          const nextCount = state.cartCount + 1;
          return {
            cartCount: nextCount,
            cartCountByUser: {
              ...state.cartCountByUser,
              [state.activeUserKey]: nextCount,
            },
          };
        }),

      /**
       * 항목 삭제 성공 시 -1 반영합니다.
       */
      decrementCart: () =>
        set((state) => {
          const nextCount = Math.max(0, state.cartCount - 1);
          return {
            cartCount: nextCount,
            cartCountByUser: {
              ...state.cartCountByUser,
              [state.activeUserKey]: nextCount,
            },
          };
        }),

      /**
       * 현재 사용자의 장바구니 개수를 0으로 초기화합니다.
       */
      clearCart: () =>
        set((state) => ({
          cartCount: 0,
          cartCountByUser: {
            ...state.cartCountByUser,
            [state.activeUserKey]: 0,
          },
        })),
    }),
    {
      name: 'cart-count-storage',
      partialize: (state) => ({
        cartCount: state.cartCount,
        activeUserKey: state.activeUserKey,
        cartCountByUser: state.cartCountByUser,
      }),
    }
  )
);

export default useCartStore;
