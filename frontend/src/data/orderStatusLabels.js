/**
 * 주문 상태 한글 라벨입니다.
 *
 * [의도]
 * 결제 실패 같은 새 상태가 추가되어도
 * 여러 화면에서 같은 한국어 문구를 재사용할 수 있게 분리했습니다.
 */
export const ORDER_STATUS_LABELS = {
  PENDING: '결제 대기',
  PAID: '결제 완료',
  PAYMENT_FAILED: '결제 실패',
  SHIPPED: '배송 중',
  DELIVERED: '배송 완료',
  CANCEL_REQUESTED: '취소 요청',
  CANCELLED: '주문 취소',
  REFUND_REQUESTED: '환불 요청',
  REFUNDED: '환불 완료',
  PURCHASE_CONFIRMED: '구매 확정',
};
