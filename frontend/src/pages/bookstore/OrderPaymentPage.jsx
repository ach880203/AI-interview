import * as PortOne from '@portone/browser-sdk/v2';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { applyOrderPaymentResult, createOrder, verifyOrderPayment } from '../../api/book';
import OrderProgressSteps from '../../components/bookstore/OrderProgressSteps';
import { clearOrderCheckoutDraft, loadOrderCheckoutDraft } from '../../data/orderCheckoutStorage';
import useAuthStore from '../../store/authStore';
import useCartStore from '../../store/cartStore';
import { formatFullAddress } from '../../utils/addressUtils';

const PORTONE_STORE_ID = import.meta.env.VITE_PORTONE_STORE_ID;
const PORTONE_CHANNEL_KEY = import.meta.env.VITE_PORTONE_CHANNEL_KEY;

/**
 * 주문 결제 확인 페이지입니다.
 *
 * [역할]
 * 1. 결제 전 주문 정보를 마지막으로 확인합니다.
 * 2. 서버에 결제 대기 주문을 먼저 생성합니다.
 * 3. PortOne 실제 결제 또는 모의 결제 결과 화면으로 이어 줍니다.
 *
 * [중요]
 * 결제창에서 취소하고 닫았을 때 PENDING 주문이 구매내역에 남으면
 * 사용자는 "결제도 안 했는데 주문이 생겼다"고 느끼게 됩니다.
 * 그래서 실제 결제창 취소도 서버에 즉시 CANCELLED로 반영합니다.
 */
export default function OrderPaymentPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const clearCart = useCartStore((state) => state.clearCart);

  const [orderCheckoutDraft] = useState(() => loadOrderCheckoutDraft());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const itemTotalPrice = useMemo(() => {
    return (orderCheckoutDraft?.items ?? []).reduce(
      (sum, item) => sum + (item.subtotal ?? item.price * item.quantity),
      0
    );
  }, [orderCheckoutDraft]);

  async function handleStartPayment() {
    if (!orderCheckoutDraft?.items?.length) {
      setError('결제에 사용할 주문 정보가 없습니다. 장바구니와 주문서를 다시 확인해 주세요.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
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

      if (PORTONE_STORE_ID) {
        await handlePortOnePayment(createdOrder);
      } else {
        navigate(`/orders/payment/callback/${createdOrder.id}`, {
          replace: true,
          state: { createdOrder },
        });
      }
    } catch (requestError) {
      if (requestError?.isPortOneHandled) {
        return;
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
   * PortOne 실제 결제를 시작합니다.
   *
   * [중요]
   * 사용자가 결제창을 닫거나 취소하면 서버 주문도 바로 정리해야
   * 결제 대기 주문이 구매내역에 남지 않습니다.
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
      const isCancelledByUser = isCancelledPaymentResponse(paymentResponse);

      await applyOrderPaymentResult(createdOrder.id, {
        resultType: isCancelledByUser ? 'CANCELLED' : 'FAILED',
        reason: paymentResponse.message ?? paymentResponse.code,
      });

      if (isCancelledByUser) {
        clearOrderCheckoutDraft();
        navigate('/cart', { replace: true });
        throw { isPortOneHandled: true };
      }

      navigate(`/orders/complete/${createdOrder.id}`, {
        replace: true,
        state: {
          createdOrder: {
            ...createdOrder,
            status: 'PAYMENT_FAILED',
            lastActionReason: paymentResponse.message ?? paymentResponse.code,
          },
        },
      });
      throw { isPortOneHandled: true };
    }

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
            <p className="text-lg font-semibold text-mentor-text">결제에 사용할 주문 정보가 없습니다.</p>
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
            결제 전에 주문 정보를 마지막으로 확인해 주세요
          </h1>
          <p className="mt-3 text-sm leading-6 text-mentor-muted">
            이 화면에서는 결제 대기 주문을 먼저 만든 뒤, 다음 단계에서 카카오페이 승인 또는 취소 결과를
            반영합니다.
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
                  실제 운영 시에는 카카오페이 결제창이 열리고, 개발 환경에서는 다음 화면에서 승인 또는 취소
                  흐름을 검증합니다.
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
                  결제창에서 취소하면 주문도 바로 취소 처리되어 구매내역 흐름에 매달리지 않게 정리합니다.
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

function PaymentInfoTile({ label, value }) {
  return (
    <div className="rounded-3xl border border-mentor-border bg-mentor-bg px-5 py-5">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-mentor-muted">{label}</p>
      <p className="mt-3 text-sm font-semibold text-mentor-text">{value}</p>
    </div>
  );
}

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

function isCancelledPaymentResponse(paymentResponse) {
  const rawMessage = `${paymentResponse?.code ?? ''} ${paymentResponse?.message ?? ''}`.toLowerCase();
  return rawMessage.includes('cancel') || rawMessage.includes('취소');
}
