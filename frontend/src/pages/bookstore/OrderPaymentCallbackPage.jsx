import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  applyOrderPaymentResult,
  getOrderDetail,
} from '../../api/book';
import OrderProgressSteps from '../../components/bookstore/OrderProgressSteps';
import { clearOrderCheckoutDraft } from '../../data/orderCheckoutStorage';
import { ORDER_STATUS_LABELS } from '../../data/orderStatusLabels';
import { formatPostalAddress } from '../../utils/addressUtils';
import useCartStore from '../../store/cartStore';

/**
 * 주문 결제 결과 선택 페이지입니다.
 *
 * [역할]
 * 실제 카카오페이 승인 콜백 대신,
 * 승인 / 실패 / 취소 중 하나를 선택해서 백엔드 상태 전환을 검증합니다.
 */
export default function OrderPaymentCallbackPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { orderId } = useParams();
  const clearCart = useCartStore((state) => state.clearCart);

  const [orderDetail, setOrderDetail] = useState(() => location.state?.createdOrder ?? null);
  const [loading, setLoading] = useState(!location.state?.createdOrder);
  const [submittingResult, setSubmittingResult] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchOrderDetail() {
      if (!orderId || orderDetail) {
        return;
      }

      setLoading(true);
      setError('');

      try {
        const response = await getOrderDetail(orderId);
        setOrderDetail(response.data?.data ?? response.data);
      } catch (requestError) {
        setError(
          requestError.response?.data?.error?.message ??
            '결제 대기 주문 정보를 불러오지 못했습니다.'
        );
      } finally {
        setLoading(false);
      }
    }

    fetchOrderDetail();
  }, [orderDetail, orderId]);

  /**
   * 사용자가 선택한 결제 결과를 서버에 반영합니다.
   *
   * [주의]
   * 승인일 때만 장바구니와 주문서 초안을 비웁니다.
   * 실패나 취소에서는 다시 시도할 수 있어야 하므로 초안을 남겨 둡니다.
   */
  async function handleSelectPaymentResult(resultType, reason) {
    if (!orderId) {
      return;
    }

    setSubmittingResult(true);
    setError('');

    try {
      const response = await applyOrderPaymentResult(orderId, {
        resultType,
        reason,
      });

      const updatedOrder = response.data?.data ?? response.data;

      if (resultType === 'APPROVED') {
        clearOrderCheckoutDraft();
        clearCart();
      }

      navigate(`/orders/complete/${updatedOrder.id}`, {
        replace: true,
        state: { createdOrder: updatedOrder },
      });
    } catch (requestError) {
      setError(
        requestError.response?.data?.error?.message ??
          '결제 결과를 반영하지 못했습니다. 잠시 후 다시 시도해 주세요.'
      );
    } finally {
      setSubmittingResult(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-mentor-bg px-4 py-10">
        <div className="mx-auto max-w-5xl space-y-6">
          <OrderProgressSteps currentStep={3} />
          <section className="rounded-[32px] bg-mentor-surface px-6 py-20 shadow-sm">
            <div className="flex justify-center">
              <span className="h-10 w-10 animate-spin rounded-full border-4 border-mentor-accent border-t-mentor-primary" />
            </div>
          </section>
        </div>
      </div>
    );
  }

  if (error && !orderDetail) {
    return (
      <div className="min-h-screen bg-mentor-bg px-4 py-10">
        <div className="mx-auto max-w-5xl space-y-6">
          <OrderProgressSteps currentStep={3} />
          <section className="rounded-[32px] bg-mentor-surface px-6 py-20 text-center shadow-sm">
            <p className="text-lg font-semibold text-mentor-text">결제 대기 주문을 불러오지 못했습니다.</p>
            <p className="mt-2 text-sm text-mentor-muted">{error}</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                to="/orders/payment"
                className="rounded-full bg-mentor-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-mentor-primary-dark"
              >
                결제 화면으로 돌아가기
              </Link>
              <Link
                to="/cart"
                className="rounded-full bg-mentor-bg px-5 py-3 text-sm font-semibold text-mentor-text transition hover:bg-mentor-border"
              >
                장바구니 보기
              </Link>
            </div>
          </section>
        </div>
      </div>
    );
  }

  const isPendingOrder = orderDetail?.status === 'PENDING';

  return (
    <div className="min-h-screen bg-mentor-bg px-4 py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-[32px] bg-mentor-surface p-7 shadow-sm">
          <p className="text-sm font-semibold text-mentor-primary">모의 결제 결과</p>
          <h1 className="mt-3 text-3xl font-bold text-mentor-text">
            카카오페이 결제 결과를 선택해 주문 상태를 반영해 주세요.
          </h1>
          <p className="mt-3 text-sm leading-6 text-mentor-muted">
            실제 운영에서는 PG 승인 콜백이 이 자리를 대신합니다. 지금은 결과를 직접 고르면서
            승인, 실패, 취소 흐름이 화면과 서버에 모두 남는지 검증합니다.
          </p>
        </section>

        <OrderProgressSteps currentStep={3} />

        {error && (
          <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
        )}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="rounded-[28px] bg-mentor-surface p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-mentor-primary">결제 대기 주문</p>
                <h2 className="mt-2 text-2xl font-bold text-mentor-text">주문 #{orderDetail?.id}</h2>
                <p className="mt-2 text-sm text-mentor-muted">
                  현재 상태: {ORDER_STATUS_LABELS[orderDetail?.status] ?? orderDetail?.status}
                </p>
              </div>
              <span className="rounded-full bg-mentor-accent px-3 py-1 text-xs font-semibold text-mentor-primary">
                {formatPaymentMethod(orderDetail?.paymentMethod)}
              </span>
            </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <DetailTile label="주문자 이름" value={orderDetail?.ordererName} />
                <DetailTile label="주문자 연락처" value={orderDetail?.ordererPhone} />
                <DetailTile label="우편번호" value={orderDetail?.postalCode ?? '미기록'} />
                <DetailTile
                  label="배송지"
                  value={formatPostalAddress(orderDetail?.postalCode, orderDetail?.address) || orderDetail?.address}
                />
                <DetailTile
                  label="총 결제 예정 금액"
                  value={`${(orderDetail?.totalPrice ?? 0).toLocaleString('ko-KR')}원`}
              />
            </div>

            {orderDetail?.items?.length > 0 && (
              <div className="mt-6 space-y-3">
                {orderDetail.items.map((item, index) => (
                  <article
                    key={`${item.bookId}-${index}`}
                    className="rounded-3xl border border-mentor-border bg-mentor-bg px-5 py-5"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-mentor-text">{item.bookTitle}</p>
                        <p className="mt-1 text-xs text-mentor-muted">수량 {item.quantity}권</p>
                      </div>
                      <p className="text-sm font-semibold text-mentor-primary">
                        {(item.price * item.quantity).toLocaleString('ko-KR')}원
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <aside className="space-y-4">
            <section className="rounded-[28px] bg-mentor-primary p-6 text-white shadow-sm">
              <h2 className="text-lg font-bold">결제 결과 선택</h2>
              <p className="mt-3 text-sm leading-6 text-white/80">
                같은 주문에 재고가 이미 잡혀 있으므로, 결과는 한 번만 선택할 수 있습니다.
                승인 시 주문이 완료되고, 실패나 취소 시 재고가 자동으로 복구됩니다.
              </p>

              {isPendingOrder ? (
                <div className="mt-6 space-y-3">
                  <button
                    type="button"
                    onClick={() =>
                      handleSelectPaymentResult('APPROVED', '카카오페이 결제가 정상 승인되었습니다.')
                    }
                    disabled={submittingResult}
                    className="w-full rounded-2xl bg-mentor-surface px-4 py-3 text-sm font-semibold text-mentor-text transition hover:bg-mentor-bg disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submittingResult ? '결제 결과 반영 중...' : '결제 승인 처리'}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleSelectPaymentResult('FAILED', '카카오페이 승인 과정에서 오류가 발생했습니다.')
                    }
                    disabled={submittingResult}
                    className="w-full rounded-2xl border border-white/20 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    결제 실패 처리
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleSelectPaymentResult('CANCELLED', '사용자가 카카오페이 결제를 취소했습니다.')
                    }
                    disabled={submittingResult}
                    className="w-full rounded-2xl border border-white/20 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    결제 취소 처리
                  </button>
                </div>
              ) : (
                <div className="mt-6 rounded-2xl bg-white/10 px-4 py-4 text-sm leading-6 text-white/85">
                  이 주문은 이미 {ORDER_STATUS_LABELS[orderDetail?.status] ?? orderDetail?.status} 상태입니다.
                  결과 화면에서 최신 내용을 확인해 주세요.
                </div>
              )}

              <div className="mt-6 flex flex-col gap-3">
                {!isPendingOrder && (
                  <Link
                    to={`/orders/complete/${orderDetail?.id}`}
                    className="inline-flex justify-center rounded-2xl bg-mentor-surface px-4 py-3 text-sm font-semibold text-mentor-text transition hover:bg-mentor-bg"
                  >
                    결과 화면으로 이동
                  </Link>
                )}
                <Link
                  to="/orders/payment"
                  className="inline-flex justify-center rounded-2xl border border-white/20 px-4 py-3 text-sm font-semibold text-white/90 transition hover:bg-white/10"
                >
                  결제 확인 화면으로 돌아가기
                </Link>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}

/**
 * 주문 요약 타일입니다.
 */
function DetailTile({ label, value }) {
  return (
    <div className="rounded-3xl border border-mentor-border bg-mentor-bg px-5 py-5">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-mentor-muted">{label}</p>
      <p className="mt-3 text-sm font-semibold text-mentor-text">{value}</p>
    </div>
  );
}

function formatPaymentMethod(paymentMethod) {
  if (paymentMethod === 'KAKAOPAY') {
    return '카카오페이';
  }

  return paymentMethod ?? '확인 필요';
}
