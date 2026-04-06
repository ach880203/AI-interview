const SUBSCRIPTION_CHECKOUT_STORAGE_KEY = 'ai_interview_subscription_checkout';

/**
 * 구독 결제 직전 선택 정보를 세션 단위로 저장합니다.
 *
 * [주의]
 * 브라우저 탭을 닫으면 자연스럽게 초기화되도록 sessionStorage를 사용합니다.
 * 주문 정보처럼 장기간 남길 필요가 없는 임시 결제 흐름이기 때문입니다.
 */
export function saveSubscriptionCheckoutDraft(subscriptionCheckoutDraft) {
  sessionStorage.setItem(
    SUBSCRIPTION_CHECKOUT_STORAGE_KEY,
    JSON.stringify(subscriptionCheckoutDraft)
  );
}

/**
 * 저장된 구독 결제 초안을 불러옵니다.
 */
export function loadSubscriptionCheckoutDraft() {
  const rawValue = sessionStorage.getItem(SUBSCRIPTION_CHECKOUT_STORAGE_KEY);

  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue);
  } catch (error) {
    /**
     * 저장 형식이 바뀌었거나 값이 깨졌을 때 이전 데이터를 버리고
     * 새 구독 흐름을 다시 시작할 수 있게 정리합니다.
     */
    sessionStorage.removeItem(SUBSCRIPTION_CHECKOUT_STORAGE_KEY);
    return null;
  }
}

/**
 * 결제가 끝난 뒤 구독 결제 초안을 비웁니다.
 */
export function clearSubscriptionCheckoutDraft() {
  sessionStorage.removeItem(SUBSCRIPTION_CHECKOUT_STORAGE_KEY);
}
