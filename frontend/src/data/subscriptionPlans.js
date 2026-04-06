/**
 * 구독 화면 전용 요금제 정의입니다.
 *
 * [설계 이유]
 * 기존 공용 설정 파일은 여러 화면이 함께 쓰고 있어서
 * 구독 결제 흐름 전용 UI 설명과 혜택 문구를 여기에 따로 분리합니다.
 */
export const SUBSCRIPTION_PLAN_OPTIONS = [
  {
    key: 'daily',
    name: '하루',
    durationText: '24시간 이용',
    durationDays: 1,
    paymentAmount: 1200,
    basePrice: 1200,
    discountText: '정가',
    highlight: '가볍게 체험',
    description: '오늘 바로 AI 면접과 학습 흐름을 빠르게 체험할 때 적합합니다.',
  },
  {
    key: 'weekly',
    name: '1주',
    durationText: '7일 이용',
    durationDays: 7,
    paymentAmount: 8400,
    basePrice: 8400,
    discountText: '정가',
    highlight: '단기 집중 준비',
    description: '짧은 준비 기간 동안 학습과 면접을 함께 묶어 집중하고 싶을 때 적합합니다.',
  },
  {
    key: 'monthly',
    name: '1개월',
    durationText: '30일 이용',
    durationDays: 30,
    paymentAmount: 28800,
    basePrice: 36000,
    discountText: '20% 할인',
    highlight: '가장 균형 잡힌 선택',
    description: '실전 면접 연습과 약점 학습을 꾸준히 반복하기에 가장 안정적인 기간입니다.',
    recommended: true,
  },
  {
    key: 'yearly',
    name: '1년',
    durationText: '365일 이용',
    durationDays: 365,
    paymentAmount: 219000,
    basePrice: 438000,
    discountText: '50% 할인',
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
  description: '구독 결제는 카카오페이 단일 흐름으로 운영해 안내 문구와 결제 경험을 단순하게 유지합니다.',
};

/**
 * 요금제 키로 전용 요금제 정보를 찾습니다.
 */
export function findSubscriptionPlan(planKey) {
  return SUBSCRIPTION_PLAN_OPTIONS.find((plan) => plan.key === planKey) ?? null;
}
