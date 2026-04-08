/**
 * 구독 화면 전용 요금제 정의입니다.
 *
 * [가격 구조]
 * - basePrice   : 정가 (부가세 제외) — 1,000원/일 × 이용일수
 * - discountRate: 할인율 (%)
 * - supplyAmount: 할인가 (부가세 제외) = basePrice × (1 - discountRate/100)
 * - vatAmount   : 부가세 = supplyAmount × 0.1
 * - paymentAmount: 총 결제금액 (부가세 포함) = supplyAmount + vatAmount
 */
export const SUBSCRIPTION_PLAN_OPTIONS = [
  {
    key: 'daily',
    name: '하루',
    durationText: '24시간 이용',
    durationDays: 1,
    basePrice: 1000,
    discountRate: 0,
    discountText: '정가',
    supplyAmount: 1000,
    vatAmount: 100,
    paymentAmount: 1100,
    highlight: '가볍게 체험',
    description: '오늘 바로 AI 면접과 학습을 빠르게 체험할 때 적합합니다.',
  },
  {
    key: 'weekly',
    name: '1주',
    durationText: '7일 이용',
    durationDays: 7,
    basePrice: 7000,
    discountRate: 20,
    discountText: '20% 할인',
    supplyAmount: 5600,
    vatAmount: 560,
    paymentAmount: 6160,
    highlight: '단기 집중 준비',
    description: '짧은 준비 기간 동안 학습과 면접을 함께 묶어 집중하고 싶을 때 적합합니다.',
  },
  {
    key: 'monthly',
    name: '1개월',
    durationText: '30일 이용',
    durationDays: 30,
    basePrice: 30000,
    discountRate: 35,
    discountText: '35% 할인',
    supplyAmount: 19500,
    vatAmount: 1950,
    paymentAmount: 21450,
    highlight: '가장 균형 잡힌 선택',
    description: '실전 면접 연습과 약점 학습을 꾸준히 반복하기에 가장 안정적인 기간입니다.',
    recommended: true,
  },
  {
    key: 'yearly',
    name: '1년',
    durationText: '365일 이용',
    durationDays: 365,
    basePrice: 365000,
    discountRate: 50,
    discountText: '50% 할인',
    supplyAmount: 182500,
    vatAmount: 18250,
    paymentAmount: 200750,
    highlight: '장기 취업 준비 전용',
    description: '긴 준비 기간 동안 여러 번의 면접과 학습 기록을 쌓아 가고 싶을 때 적합합니다.',
  },
];

/**
 * 구독 결제는 현재 카카오페이 단일 흐름으로 안내합니다.
 */
export const SUBSCRIPTION_PAYMENT_METHOD = {
  key: 'KAKAOPAY',
  label: '카카오페이',
  description: '현재 결제는 카카오페이 만 운영중입니다. 추후 토스 등 다른 결제 수단도 추가될 예정입니다.',
};

/**
 * 요금제 키로 전용 요금제 정보를 찾습니다.
 */
export function findSubscriptionPlan(planKey) {
  return SUBSCRIPTION_PLAN_OPTIONS.find((plan) => plan.key === planKey) ?? null;
}
