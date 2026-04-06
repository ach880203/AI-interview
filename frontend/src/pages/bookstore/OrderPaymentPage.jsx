import * as PortOne from '@portone/browser-sdk/v2';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createOrder, verifyOrderPayment } from '../../api/book';
import OrderProgressSteps from '../../components/bookstore/OrderProgressSteps';
import { clearOrderCheckoutDraft, loadOrderCheckoutDraft } from '../../data/orderCheckoutStorage';
import useAuthStore from '../../store/authStore';
import useCartStore from '../../store/cartStore';
import { formatFullAddress } from '../../utils/addressUtils';

/** PortOne 스토어 ID가 설정되어 있으면 실제 결제창을 사용합니다. */
const PORTONE_STORE_ID = import.meta.env.VITE_PORTONE_STORE_ID;
const PORTONE_CHANNEL_KEY = import.meta.env.VITE_PORTONE_CHANNEL_KEY;

/**
 * 주문 결제 확인 페이지입니다.
 *
 * [역할]
 * 주문서를 마지막으로 확인하고,
 * 실제 결제 결과 선택 화면으로 넘어가기 전에 결제 대기 주문을 먼저 생성합니다.
 */
export default function OrderPaymentPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);

  const [orderCheckoutDraft] = useState(() => loadOrderCheckoutDraft());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const clearCart = useCartStore((state) => state.clearCart);

  const itemTotalPrice = useMemo(() => {
    return (orderCheckoutDraft?.items ?? []).reduce(
      (sum, item) => sum + (item.subtotal ?? item.price * item.quantity),
      0
    );
  }, [orderCheckoutDraft]);

  /**
   * 결제를 시작합니다.
   *
   * [분기]
   * - VITE_PORTONE_STORE_ID가 설정된 경우: PortOne SDK 실제 결제창 호출
   * - 설정되지 않은 경우: 모의 결제 콜백 페이지로 이동 (로컬 개발용)
   *
   * [PortOne V2 흐름]
   * 1. 주문 생성 (PENDING)
   * 2. PortOne SDK requestPayment() 호출 → 카카오페이 결제창
   * 3. 결제 완료 후 paymentId를 백엔드에 전송
   * 4. 백엔드에서 PortOne API 직접 조회 → 금액·상태 검증 → PAID 확정
   */
  async function handleStartPayment() {
    if (!orderCheckoutDraft?.items?.length) {
      setError('결제에 사용할 주문서 정보가 없습니다. 장바구니와 주문서를 다시 확인해 주세요.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      // 1단계: 결제 대기 주문 생성
      const response = await createOrder({
        ordererName: orderCheckoutDraft.ordererName,
        ordererPhone: orderCheckoutDraft.ordererPhone,
        postalCode: orderCheckoutDraft.postalCode,
        address: orderCheckoutDraft.address,
        detailAddress: orderCheckoutDraft.detailAddress,
        paymentMethod: orderCheckoutDraft.paymentMethod,
        saveShippingInfo: orderCheckoutDraft.saveShippingInfo,
        items: orderCheckoutDraft.items.map((item) => ({
          bookId: item.bookId,
          quantity: item.quantity,
        })),
      });

      const createdOrder = response.data?.data ?? response.data;

      if (orderCheckoutDraft.saveShippingInfo) {
        setUser({
          ...(user ?? {}),
          shippingPostalCode: orderCheckoutDraft.postalCode,
          shippingAddress: orderCheckoutDraft.address,
          shippingDetailAddress: orderCheckoutDraft.detailAddress,
        });
      }

      // 2단계: PortOne 설정 여부에 따라 분기
      if (PORTONE_STORE_ID) {
        await handlePortOnePayment(createdOrder);
      } else {
        // 모의 결제 흐름 (로컬 개발용)
        navigate(`/orders/payment/callback/${createdOrder.id}`, {
          replace: true,
          state: { createdOrder },
        });
      }
    } catch (requestError) {
      if (requestError?.isPortOneError) {
        return; // PortOne 에러는 내부에서 이미 처리됨
      }
      setError(
        requestError.response?.data?.error?.message ??
          '결제 준비 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  /**
   * PortOne SDK로 실제 결제창을 호출하고 결과를 검증합니다.
   *
   * [paymentId 형식]
   * "order_{orderId}_{timestamp}" — PortOne에서 각 결제를 식별하는 고유 ID
   */
  async function handlePortOnePayment(createdOrder) {
    const paymentId = `order_${createdOrder.id}_${Date.now()}`;

    const orderName =
      orderCheckoutDraft.items.length === 1
        ? orderCheckoutDraft.items[0].bookTitle
        : `${orderCheckoutDraft.items[0].bookTitle} 외 ${orderCheckoutDraft.items.length - 1}권`;

    const paymentResponse = await PortOne.requestPayment({
      storeId: PORTONE_STORE_ID,
      channelKey: PORTONE_CHANNEL_KEY,
      paymentId,
      orderName,
      totalAmount: createdOrder.totalPrice,
      currency: 'CURRENCY_KRW',
      payMethod: 'EASY_PAY',
      easyPay: { easyPayProvider: 'EASY_PAY_PROVIDER_KAKAOPAY' },
    });

    if (paymentResponse?.code) {
      // 사용자가 결제창을 닫거나 결제 실패
      setError(`결제가 취소되었거나 실패했습니다. (${paymentResponse.message ?? paymentResponse.code})`);
      throw { isPortOneError: true };
    }

    // 3단계: 백엔드 서버사이드 검증
    const verifyResponse = await verifyOrderPayment(createdOrder.id, { paymentId });
    const confirmedOrder = verifyResponse.data?.data ?? verifyResponse.data;

    clearOrderCheckoutDraft();
    clearCart();

    navigate(`/orders/complete/${confirmedOrder.id}`, {
      replace: true,
      state: { createdOrder: confirmedOrder },
    });
  }

  if (!orderCheckoutDraft?.items?.length) {
    return (
      <div className="min-h-screen bg-mentor-bg px-4 py-10">
        <div className="mx-auto max-w-5xl space-y-6">
          <OrderProgressSteps currentStep={3} />
          <section className="rounded-[32px] bg-mentor-surface px-6 py-20 text-center shadow-sm">
            <p className="text-lg font-semibold text-mentor-text">결제에 사용할 주문서 정보가 없습니다.</p>
            <p className="mt-2 text-sm text-mentor-muted">
              주문서를 먼저 작성한 뒤 결제 단계로 다시 이동해 주세요.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                to="/orders/checkout"
                className="rounded-full bg-mentor-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-mentor-primary-dark"
              >
                주문서로 이동
              </Link>
              <Link
                to="/cart"
                className="rounded-full bg-mentor-bg px-5 py-3 text-sm font-semibold text-mentor-text transition hover:bg-mentor-border"
              >
                장바구니로 이동
              </Link>
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-mentor-bg px-4 py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-[32px] bg-mentor-surface p-7 shadow-sm">
          <p className="text-sm font-semibold text-mentor-primary">결제 진행</p>
          <h1 className="mt-3 text-3xl font-bold text-mentor-text">
            결제 전에 주문 정보를 마지막으로 확인해 주세요.
          </h1>
          <p className="mt-3 text-sm leading-6 text-mentor-muted">
            이 화면에서는 결제 대기 주문을 먼저 만들고, 다음 단계에서 카카오페이 승인 결과를
            시뮬레이션합니다. 실제 PG를 붙일 때도 이 화면은 결제 진입점 역할을 그대로 유지합니다.
          </p>
        </section>

        <OrderProgressSteps currentStep={3} />

        {error && (
          <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
        )}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="space-y-4">
            <section className="rounded-[28px] bg-mentor-surface p-6 shadow-sm">
              <h2 className="text-lg font-bold text-mentor-text">주문자 및 배송 정보</h2>
              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <PaymentInfoTile label="주문자 이름" value={orderCheckoutDraft.ordererName} />
                <PaymentInfoTile label="주문자 연락처" value={orderCheckoutDraft.ordererPhone} />
                <PaymentInfoTile label="우편번호" value={orderCheckoutDraft.postalCode || '미입력'} />
                <PaymentInfoTile label="기본 주소" value={orderCheckoutDraft.address} />
                <PaymentInfoTile
                  label="상세 주소"
                  value={orderCheckoutDraft.detailAddress || '상세 주소 없음'}
                />
                <PaymentInfoTile
                  label="기본 배송지 저장"
                  value={orderCheckoutDraft.saveShippingInfo ? '저장함' : '저장 안 함'}
                />
              </div>
            </section>

            <section className="rounded-[28px] bg-mentor-surface p-6 shadow-sm">
              <h2 className="text-lg font-bold text-mentor-text">결제 상품 확인</h2>
              <div className="mt-5 space-y-3">
                {orderCheckoutDraft.items.map((item) => (
                  <article
                    key={`${item.bookId}-${item.quantity}`}
                    className="rounded-3xl border border-mentor-border bg-mentor-bg px-5 py-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-mentor-text">{item.bookTitle}</p>
                        <p className="mt-1 text-sm text-mentor-muted">{item.bookAuthor}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-mentor-primary">
                          {(item.subtotal ?? item.price * item.quantity).toLocaleString('ko-KR')}원
                        </p>
                        <p className="mt-1 text-xs text-mentor-muted">수량 {item.quantity}권</p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </section>

          <aside className="space-y-4">
            <section className="rounded-[28px] bg-mentor-surface p-6 shadow-sm">
              <h2 className="text-lg font-bold text-mentor-text">결제 수단 확인</h2>
              <div className="mt-5 rounded-2xl border border-mentor-primary bg-mentor-accent/60 px-4 py-4">
                <p className="text-sm font-semibold text-mentor-text">카카오페이</p>
                <p className="mt-1 text-xs leading-5 text-mentor-muted">
                  다음 화면에서 카카오페이 결제 결과를 모의로 선택합니다. 실제 운영 시에는 이 자리에
                  결제창 호출과 승인 콜백이 연결됩니다.
                </p>
              </div>
            </section>

            <section className="rounded-[28px] bg-mentor-primary p-6 text-white shadow-sm">
              <h2 className="text-lg font-bold">최종 결제 확인</h2>
              <div className="mt-5 space-y-3 text-sm">
                <PaymentSummaryRow label="주문 상품 수" value={`${orderCheckoutDraft.items.length}권`} />
                <PaymentSummaryRow label="총 수량" value={`${orderCheckoutDraft.totalQuantity ?? 0}개`} />
                <PaymentSummaryRow
                  label="배송지"
                  value={
                    formatFullAddress(
                      orderCheckoutDraft.postalCode,
                      orderCheckoutDraft.address,
                      orderCheckoutDraft.detailAddress
                    ) || '확인 필요'
                  }
                />
                <PaymentSummaryRow
                  label="결제 수단"
                  value={formatPaymentMethod(orderCheckoutDraft.paymentMethod)}
                />
                <PaymentSummaryRow
                  label="기본 배송지 저장"
                  value={orderCheckoutDraft.saveShippingInfo ? '저장함' : '저장 안 함'}
                />
              </div>

              <div className="mt-5 border-t border-white/10 pt-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-white/70">최종 결제 예정 금액</span>
                  <span className="text-2xl font-bold">
                    {itemTotalPrice.toLocaleString('ko-KR')}원
                  </span>
                </div>
                <p className="mt-2 text-xs text-white/70">
                  주문은 먼저 결제 대기 상태로 만들어지고, 다음 단계에서 승인 또는 취소 결과가 반영됩니다.
                </p>
              </div>

              <button
                type="button"
                onClick={handleStartPayment}
                disabled={submitting}
                className="mt-5 w-full rounded-2xl bg-mentor-surface px-4 py-3 text-sm font-semibold text-mentor-text transition hover:bg-mentor-bg disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? '결제 준비 중...' : '카카오페이 결제창으로 이동'}
              </button>

              <Link
                to="/orders/checkout"
                className="mt-3 inline-flex w-full justify-center rounded-2xl border border-white/20 px-4 py-3 text-sm font-semibold text-white/90 transition hover:bg-white/10"
              >
                주문서로 돌아가기
              </Link>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}

/**
 * 결제 정보 타일입니다.
 */
function PaymentInfoTile({ label, value }) {
  return (
    <div className="rounded-3xl border border-mentor-border bg-mentor-bg px-5 py-5">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-mentor-muted">{label}</p>
      <p className="mt-3 text-sm font-semibold text-mentor-text">{value}</p>
    </div>
  );
}

/**
 * 결제 요약 행입니다.
 */
function PaymentSummaryRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-white/70">{label}</span>
      <span className="max-w-[180px] text-right font-semibold text-white">{value}</span>
    </div>
  );
}

function formatPaymentMethod(paymentMethod) {
  if (paymentMethod === 'KAKAOPAY') {
    return '카카오페이';
  }

  return paymentMethod ?? '확인 필요';
}
