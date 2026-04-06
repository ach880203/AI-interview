const ORDER_CHECKOUT_DRAFT_KEY = 'ai_interview_order_checkout_draft';

/**
 * 주문서 초안 정보를 세션 저장소에 보관합니다.
 *
 * [이유]
 * 장바구니 → 주문서 → 결제 페이지로 이동할 때 새로고침이 발생해도
 * 사용자가 방금 입력한 정보를 잃지 않게 하려는 목적입니다.
 * localStorage 대신 sessionStorage를 써서 브라우저 세션이 끝나면 자동으로 비워지게 합니다.
 */
export function saveOrderCheckoutDraft(orderCheckoutDraft) {
  sessionStorage.setItem(ORDER_CHECKOUT_DRAFT_KEY, JSON.stringify(orderCheckoutDraft));
}

/**
 * 저장된 주문서 초안을 읽어 옵니다.
 *
 * [주의]
 * JSON 파싱이 실패하면 깨진 초안을 계속 들고 가지 않도록 즉시 삭제하고 null을 반환합니다.
 */
export function loadOrderCheckoutDraft() {
  const rawDraft = sessionStorage.getItem(ORDER_CHECKOUT_DRAFT_KEY);
  if (!rawDraft) {
    return null;
  }

  try {
    return JSON.parse(rawDraft);
  } catch (error) {
    console.error('주문서 초안 정보를 읽는 중 문제가 발생했습니다.', error);
    sessionStorage.removeItem(ORDER_CHECKOUT_DRAFT_KEY);
    return null;
  }
}

/**
 * 주문서 초안을 삭제합니다.
 *
 * [의도]
 * 결제가 끝난 뒤 이전 주문서 정보가 다음 주문에 섞이지 않게 하려는 정리 단계입니다.
 */
export function clearOrderCheckoutDraft() {
  sessionStorage.removeItem(ORDER_CHECKOUT_DRAFT_KEY);
}
