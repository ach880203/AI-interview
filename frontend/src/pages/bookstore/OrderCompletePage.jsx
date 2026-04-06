import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { getOrderDetail } from '../../api/book';
import OrderProgressSteps from '../../components/bookstore/OrderProgressSteps';
import { ORDER_STATUS_LABELS } from '../../data/orderStatusLabels';
import { formatPostalAddress } from '../../utils/addressUtils';

/**
 * 주문 결제 결과 페이지입니다.
 *
 * [역할]
 * 승인, 실패, 취소 결과를 모두 이 화면에서 보여 줍니다.
 * 그래서 페이지 이름은 완료지만 실제로는 주문 결제 결과 확인 화면에 가깝습니다.
 */
export default function OrderCompletePage() {
  const location = useLocation();
  const { orderId } = useParams();

  const [orderDetail, setOrderDetail] = useState(() => location.state?.createdOrder ?? null);
  const [loading, setLoading] = useState(!location.state?.createdOrder);
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
            '주문 결과 정보를 불러오지 못했습니다.'
        );
      } finally {
        setLoading(false);
      }
    }

    fetchOrderDetail();
  }, [orderDetail, orderId]);

  const resultMeta = useMemo(
    () => buildOrderResultMeta(orderDetail?.status, orderDetail?.id),
    [orderDetail?.id, orderDetail?.status]
  );

  return (
    <div className="min-h-screen bg-mentor-bg px-4 py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <OrderProgressSteps currentStep={4} />

        {loading ? (
          <section className="rounded-[32px] bg-mentor-surface px-6 py-20 shadow-sm">
            <div className="flex justify-center">
              <span className="h-10 w-10 animate-spin rounded-full border-4 border-mentor-accent border-t-mentor-primary" />
            </div>
          </section>
        ) : error ? (
          <section className="rounded-[32px] bg-mentor-surface px-6 py-20 text-center shadow-sm">
            <p className="text-lg font-semibold text-mentor-text">주문 결과 정보를 불러오지 못했습니다.</p>
            <p className="mt-2 text-sm text-mentor-muted">{error}</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                to="/orders"
                className="rounded-full bg-mentor-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-mentor-primary-dark"
              >
                주문 이력 보기
              </Link>
              <Link
                to="/cart"
                className="rounded-full bg-mentor-bg px-5 py-3 text-sm font-semibold text-mentor-text transition hover:bg-mentor-border"
              >
                장바구니로 이동
              </Link>
            </div>
          </section>
        ) : (
          <>
            <section className="rounded-[32px] bg-mentor-surface p-8 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-mentor-primary">{resultMeta.eyebrow}</p>
                  <h1 className="mt-3 text-3xl font-bold text-mentor-text">{resultMeta.title}</h1>
                  <p className="mt-3 text-sm leading-6 text-mentor-muted">
                    {resultMeta.description}
                  </p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${resultMeta.badgeClassName}`}>
                  {ORDER_STATUS_LABELS[orderDetail?.status] ?? orderDetail?.status ?? '확인 필요'}
                </span>
              </div>

              <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <OrderInfoTile label="주문 번호" value={`#${orderDetail?.id ?? '-'}`} />
                <OrderInfoTile label="결제 수단" value={formatPaymentMethod(orderDetail?.paymentMethod)} />
                <OrderInfoTile label="주문자 이름" value={orderDetail?.ordererName ?? '미기록'} />
                <OrderInfoTile label="주문자 연락처" value={orderDetail?.ordererPhone ?? '미기록'} />
                <OrderInfoTile label="우편번호" value={orderDetail?.postalCode ?? '미기록'} />
              </div>
            </section>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
              <section className="space-y-4">
                <section className="rounded-[28px] bg-mentor-surface p-6 shadow-sm">
                  <h2 className="text-lg font-bold text-mentor-text">배송 정보</h2>
                  <p className="mt-4 text-sm leading-6 text-mentor-muted">
                    {formatPostalAddress(orderDetail?.postalCode, orderDetail?.address) ||
                      orderDetail?.address}
                  </p>
                </section>

                <section className="rounded-[28px] bg-mentor-surface p-6 shadow-sm">
                  <h2 className="text-lg font-bold text-mentor-text">주문 상품</h2>
                  <div className="mt-5 space-y-3">
                    {orderDetail?.items?.map((item, index) => (
                      <article
                        key={`${item.bookId}-${index}`}
                        className="rounded-3xl border border-mentor-border bg-mentor-bg px-5 py-5"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-mentor-text">{item.bookTitle}</p>
                            <p className="mt-1 text-sm text-mentor-muted">수량 {item.quantity}권</p>
                          </div>
                          <p className="text-sm font-semibold text-mentor-primary">
                            {(item.price * item.quantity).toLocaleString('ko-KR')}원
                          </p>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>

                {orderDetail?.lastActionReason && (
                  <section className="rounded-[28px] bg-mentor-surface p-6 shadow-sm">
                    <h2 className="text-lg font-bold text-mentor-text">마지막 처리 사유</h2>
                    <p className="mt-4 text-sm leading-6 text-mentor-muted">{orderDetail.lastActionReason}</p>
                  </section>
                )}
              </section>

              <aside className="space-y-4">
                <section className="rounded-[28px] bg-mentor-primary p-6 text-white shadow-sm">
                  <h2 className="text-lg font-bold">주문 요약</h2>
                  <div className="mt-5 space-y-3 text-sm">
                    <CompleteSummaryRow label="주문 번호" value={`#${orderDetail?.id ?? '-'}`} />
                    <CompleteSummaryRow label="주문 일시" value={formatOrderDate(orderDetail?.orderedAt)} />
                    <CompleteSummaryRow
                      label="총 결제 금액"
                      value={`${(orderDetail?.totalPrice ?? 0).toLocaleString('ko-KR')}원`}
                    />
                  </div>
                </section>

                <div className="flex flex-col gap-3">
                  {resultMeta.primaryAction}
                  {resultMeta.secondaryAction}
                </div>
              </aside>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function OrderInfoTile({ label, value }) {
  return (
    <article className="rounded-3xl border border-mentor-border bg-mentor-bg px-5 py-5">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-mentor-muted">{label}</p>
      <p className="mt-3 text-sm font-semibold text-mentor-text">{value}</p>
    </article>
  );
}

function CompleteSummaryRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-white/70">{label}</span>
      <span className="max-w-[180px] text-right font-semibold text-white">{value}</span>
    </div>
  );
}

/**
 * 주문 상태에 따라 화면 문구와 이동 버튼을 정합니다.
 *
 * [의도]
 * 결과 화면이 성공 전용처럼 보이지 않게 하고,
 * 실패나 취소에서도 다음 행동이 분명히 보이도록 한곳에서 관리합니다.
 */
function buildOrderResultMeta(status, orderId) {
  if (status === 'PAID') {
    return {
      eyebrow: '결제 완료',
      title: '주문이 정상적으로 접수되었습니다.',
      description:
        '결제 승인이 완료되어 주문이 저장되었습니다. 이제 주문 이력과 상세 화면에서 배송 상태를 이어서 확인할 수 있습니다.',
      badgeClassName: 'bg-emerald-50 text-emerald-600',
      primaryAction: (
        <Link
          to="/orders"
          className="inline-flex justify-center rounded-full bg-mentor-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-mentor-primary-dark"
        >
          주문 이력 보기
        </Link>
      ),
      secondaryAction: (
        <Link
          to="/books"
          className="inline-flex justify-center rounded-full bg-mentor-surface px-5 py-3 text-sm font-semibold text-mentor-text transition hover:bg-mentor-border"
        >
          도서 계속 둘러보기
        </Link>
      ),
    };
  }

  if (status === 'CANCELLED') {
    return {
      eyebrow: '결제 취소',
      title: '결제가 취소되어 주문이 종료되었습니다.',
      description:
        '장바구니와 주문서 초안은 그대로 남겨 두었습니다. 내용을 다시 확인한 뒤 결제를 다시 시도할 수 있습니다.',
      badgeClassName: 'bg-amber-50 text-amber-700',
      primaryAction: (
        <Link
          to="/orders/payment"
          className="inline-flex justify-center rounded-full bg-mentor-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-mentor-primary-dark"
        >
          결제 다시 시도
        </Link>
      ),
      secondaryAction: (
        <Link
          to="/cart"
          className="inline-flex justify-center rounded-full bg-mentor-surface px-5 py-3 text-sm font-semibold text-mentor-text transition hover:bg-mentor-border"
        >
          장바구니 보기
        </Link>
      ),
    };
  }

  if (status === 'PAYMENT_FAILED') {
    return {
      eyebrow: '결제 실패',
      title: '결제 승인에 실패했습니다.',
      description:
        '재고는 자동으로 복구되었고, 주문서는 다시 시도할 수 있도록 남겨 두었습니다. 결제 수단이나 입력 내용을 확인한 뒤 다시 진행해 주세요.',
      badgeClassName: 'bg-rose-50 text-rose-600',
      primaryAction: (
        <Link
          to="/orders/payment"
          className="inline-flex justify-center rounded-full bg-mentor-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-mentor-primary-dark"
        >
          결제 다시 시도
        </Link>
      ),
      secondaryAction: (
        <Link
          to="/orders"
          className="inline-flex justify-center rounded-full bg-mentor-surface px-5 py-3 text-sm font-semibold text-mentor-text transition hover:bg-mentor-border"
        >
          주문 이력 보기
        </Link>
      ),
    };
  }

  return {
    eyebrow: '결제 결과 확인',
    title: '결제 결과를 기다리고 있습니다.',
    description:
      '아직 결제 완료 여부가 확정되지 않았습니다. 결제 결과 선택 화면으로 돌아가 승인 또는 취소 결과를 반영해 주세요.',
    badgeClassName: 'bg-slate-100 text-slate-600',
    primaryAction: (
      <Link
        to={orderId ? `/orders/payment/callback/${orderId}` : '/orders/payment'}
        className="inline-flex justify-center rounded-full bg-mentor-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-mentor-primary-dark"
      >
        결제 결과 선택으로 이동
      </Link>
    ),
    secondaryAction: (
      <Link
        to="/orders/payment"
        className="inline-flex justify-center rounded-full bg-mentor-surface px-5 py-3 text-sm font-semibold text-mentor-text transition hover:bg-mentor-border"
      >
        결제 화면으로 돌아가기
      </Link>
    ),
  };
}

function formatPaymentMethod(paymentMethod) {
  if (paymentMethod === 'KAKAOPAY') {
    return '카카오페이';
  }

  return paymentMethod ?? '확인 필요';
}

function formatOrderDate(value) {
  if (!value) {
    return '확인 필요';
  }

  return new Date(value).toLocaleString('ko-KR');
}
