/**
 * 포털 공통 설정 데이터입니다.
 *
 * [역할]
 * 여러 화면에서 반복해서 쓰는 메뉴 구조, 결제 수단, 구독 요금제,
 * 주문 사유 예시를 한 곳에서 관리합니다.
 *
 * [의도]
 * 헤더, 마이페이지, 주문, 관리자 화면이 서로 다른 이름이나 규칙을 쓰면
 * 사용자가 흐름을 이해하기 어려워집니다.
 * 공통 설정으로 묶어 두면 화면 구조를 바꿔도 용어와 기준을 쉽게 유지할 수 있습니다.
 */

/**
 * 헤더 드롭다운 메뉴 정의입니다.
 *
 * [주의]
 * label은 화면에 그대로 노출되므로 반드시 한글로 유지합니다.
 */
export const HEADER_MENU_GROUPS = [
  {
    key: 'interview',
    label: '면접',
    items: [
      { to: '/interview/setup', label: '면접 시작', description: '문서를 선택해 맞춤 면접을 바로 시작합니다.' },
      { to: '/interview/history', label: '면접 이력', description: '완료한 면접 기록과 결과를 확인합니다.' },
      { to: '/interview/review', label: '면접 복습', description: '이전 면접 질문과 답변을 다시 복습합니다.' },
      { to: '/profile/resume', label: '이력서 등록', description: '면접에 사용할 이력서를 등록하고 관리합니다.' },
      { to: '/profile/cover-letter', label: '자기소개서 등록', description: '자기소개서를 등록하고 수정합니다.' },
      { to: '/profile/job-posting', label: '채용공고 등록', description: '채용공고를 등록해 맞춤 질문 품질을 높입니다.' },
    ],
  },
  {
    key: 'learning',
    label: '학습',
    items: [
      { to: '/learning', label: '학습하기', description: '과목과 난이도를 선택해 AI 학습을 시작합니다.' },
      { to: '/wrong-answers', label: '오답노트', description: '틀린 학습 문제를 다시 풀어 보며 보완합니다.' },
      { to: '/learning/weakness', label: '학습약점 보기', description: '과목별 정확도와 약점 영역을 확인합니다.' },
    ],
  },
  {
    key: 'book',
    label: '도서',
    directTo: '/books',
    items: [
      { to: '/books', label: '도서 둘러보기', description: '학습 과목과 연결된 추천 서적을 확인합니다.' },
    ],
  },
];

/**
 * 마이페이지 드롭다운 메뉴 정의입니다.
 *
 * [의도]
 * 이름 클릭 한 번으로 자주 쓰는 개인 메뉴에 바로 이동할 수 있게 합니다.
 */
export const MY_PAGE_MENU_ITEMS = [
  { to: '/mypage?section=profile', label: '내정보수정' },
  { to: '/mypage?section=orders', label: '구매내역확인' },
  { to: '/mypage?section=resumes', label: '내 이력서 확인' },
  { to: '/mypage?section=cover-letters', label: '내 자기소개서 확인' },
  { to: '/mypage?section=job-postings', label: '내 공고확인' },
  { to: '/mypage?section=memos', label: '내 메모장' },
  { to: '/mypage?section=wishlist', label: '내 찜목록' },
  { to: '/mypage?section=inquiries', label: '내 문의 내역' },
  { to: '/support', label: '고객센터' },
];

/**
 * 카드 결제 수수료 안내를 포함한 구독 요금제 정의입니다.
 */
export const SUBSCRIPTION_PLANS = [
  {
    key: 'daily',
    name: '하루',
    periodText: '24시간 이용',
    basePrice: 1000,
    discountRate: 0,
    finalPrice: 1000,
    vatAmount: 100,
    paymentAmount: 1100,
    discountText: '정가',
    highlight: '가볍게 체험',
  },
  {
    key: 'weekly',
    name: '1주',
    periodText: '7일 이용',
    basePrice: 7000,
    discountRate: 20,
    finalPrice: 5600,
    vatAmount: 560,
    paymentAmount: 6160,
    discountText: '20% 할인',
    highlight: '단기 집중 준비',
  },
  {
    key: 'monthly',
    name: '한 달',
    periodText: '30일 이용',
    basePrice: 30000,
    discountRate: 35,
    finalPrice: 19500,
    vatAmount: 1950,
    paymentAmount: 21450,
    discountText: '35% 할인',
    highlight: '가장 균형 잡힌 선택',
    recommended: true,
  },
  {
    key: 'yearly',
    name: '1년',
    periodText: '365일 이용',
    basePrice: 365000,
    discountRate: 50,
    finalPrice: 182500,
    vatAmount: 18250,
    paymentAmount: 200750,
    discountText: '50% 할인',
    highlight: '장기 취업 준비 전용',
  },
];

/**
 * 주문 화면과 마이페이지에서 공통으로 보여 줄 결제 수단 목록입니다.
 *
 * [주의]
 * 현재는 준비 UI 단계이므로 실제 결제 연동 키는 포함하지 않습니다.
 */
export const PAYMENT_METHODS = [
  {
    key: 'kakaopay',
    label: '카카오페이',
    description: '카카오페이 연동 준비 상태입니다. 결제창 연결만 남겨 둔 구조입니다.',
  },
  {
    key: 'tosspay',
    label: '토스페이',
    description: '토스페이 연동 준비 상태입니다. 결제 위젯 연결 전에 UI를 먼저 맞췄습니다.',
  },
  {
    key: 'card',
    label: '카드결제',
    description: '일반 카드 결제 흐름입니다. 결제 수수료 10%를 별도로 안내합니다.',
  },
];

/**
 * 구매 취소 사유 선택 목록입니다.
 *
 * [의도]
 * 취소/환불 시 사유를 선택하게 한 뒤 관리자 승인을 거쳐 처리합니다.
 * '기타'를 선택하면 직접 입력할 수 있습니다.
 */
export const CANCEL_REASON_OPTIONS = [
  { key: 'simple_change', label: '단순변심' },
  { key: 'order_mistake', label: '주문 실수' },
  { key: 'payment_mistake', label: '결제 실수' },
  { key: 'add_product', label: '상품 추가' },
  { key: 'other', label: '기타' },
];

/**
 * 환불 요청 사유 선택 목록입니다.
 */
export const REFUND_REASON_OPTIONS = [
  { key: 'simple_change', label: '단순변심' },
  { key: 'order_mistake', label: '주문 실수' },
  { key: 'payment_mistake', label: '결제 실수' },
  { key: 'add_product', label: '상품 추가' },
  { key: 'other', label: '기타' },
];

/**
 * 주소 검색 준비 UI에 보여 줄 예시 검색 결과입니다.
 *
 * [의도]
 * 실제 다음 주소 검색 API를 붙이기 전에 입력 흐름과 선택 UI를 먼저 검증합니다.
 */
export const ADDRESS_SEARCH_PRESETS = [
  {
    postalCode: '06236',
    roadAddress: '서울 강남구 테헤란로 123',
    buildingName: 'AI 멘토 타워',
    regionLabel: '강남',
  },
  {
    postalCode: '05551',
    roadAddress: '서울 송파구 올림픽로 300',
    buildingName: '서울 비즈 센터',
    regionLabel: '잠실',
  },
  {
    postalCode: '13494',
    roadAddress: '경기 성남시 분당구 판교역로 235',
    buildingName: '판교 스퀘어',
    regionLabel: '판교',
  },
];

/**
 * 주문 상태 라벨입니다.
 */
export const ORDER_STATUS_LABELS = {
  PENDING: '결제 대기',
  PAID: '결제 완료',
  SHIPPED: '배송 중',
  DELIVERED: '배송 완료',
  CANCEL_REQUESTED: '취소 요청',
  CANCELLED: '주문 취소',
  REFUND_REQUESTED: '환불 요청',
  REFUNDED: '환불 완료',
  PURCHASE_CONFIRMED: '구매 확정',
};
