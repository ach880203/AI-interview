import { useEffect, useMemo, useState } from 'react';
import {
  cancelOrder,
  confirmOrderPurchase,
  getOrderDetail,
  getOrders,
  requestOrderRefund,
} from '../../api/book';
import { CANCEL_REASON_OPTIONS, REFUND_REASON_OPTIONS } from '../../data/portalConfig';
import { ORDER_STATUS_LABELS } from '../../data/orderStatusLabels';
import { formatPostalAddress } from '../../utils/addressUtils';
import ReasonSelectModal from '../../components/common/ReasonSelectModal';

/**
 * 주문 내역 페이지입니다.
 *
 * [역할]
 * 주문 상태를 확인하고 상세 상품 목록을 펼쳐 볼 수 있게 합니다.
 *
 * [의도]
 * 마이페이지의 구매내역과 정책을 공유하면서도,
 * 주문 자체만 빠르게 확인하고 싶은 경우를 위해 별도 화면으로 유지합니다.
 */
export default function OrderPage() {
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoadingOrderId, setActionLoadingOrderId] = useState(null);
  const [error, setError] = useState('');
  const [reasonModal, setReasonModal] = useState(null);

  /**
   * 주문 목록을 불러옵니다.
   */
  useEffect(() => {
    async function fetchOrders() {
      setLoading(true);
      setError('');

      try {
        const response = await getOrders();
        const orderList = response.data?.data ?? response.data ?? [];
        setOrders(orderList.map(buildOrderViewModel));
      } catch (requestError) {
        setError(
          requestError.response?.data?.error?.message ??
            '주문 내역을 불러오지 못했습니다.'
        );
      } finally {
        setLoading(false);
      }
    }

    fetchOrders();
  }, []);

  /**
   * 주문 상세를 불러옵니다.
   */
  async function handleOpenDetail(orderId) {
    setDetailLoading(true);

    try {
      const response = await getOrderDetail(orderId);
      const detail = response.data?.data ?? response.data;
      setSelectedOrder(buildOrderViewModel(detail));
    } catch (requestError) {
      setSelectedOrder({
        id: orderId,
        error:
          requestError.response?.data?.error?.message ??
          '주문 상세를 불러오지 못했습니다.',
      });
    } finally {
      setDetailLoading(false);
    }
  }

  /**
   * 주문 액션을 실제 API에 반영합니다.
   *
   * [중요]
   * 이전에는 화면 상태만 바꿨기 때문에 새로고침하면 원래 값으로 돌아갔습니다.
   * 이제는 서버 응답을 그대로 사용해서 주문 목록, 상세 모달, 마이페이지가 같은 상태를 보게 만듭니다.
   */
  async function handleOrderAction(orderId, actionType, reason) {
    setActionLoadingOrderId(orderId);
    setError('');

    try {
      const requestMap = {
        purchaseConfirm: () =>
          confirmOrderPurchase(orderId, { reason }),
        refundRequest: () =>
          requestOrderRefund(orderId, { reason }),
        cancel: () =>
          cancelOrder(orderId, { reason }),
      };

      const response = await requestMap[actionType]();
      const updatedOrder = buildOrderViewModel(response.data?.data ?? response.data);

      setOrders((previous) =>
        previous.map((order) => (order.id === orderId ? { ...order, ...updatedOrder } : order))
      );
      setSelectedOrder((previous) =>
        previous?.id === orderId ? updatedOrder : previous
      );
    } catch (requestError) {
      setError(
        requestError.response?.data?.error?.message ??
          '주문 상태를 변경하지 못했습니다.'
      );
    } finally {
      setActionLoadingOrderId(null);
    }
  }

  const summary = useMemo(() => {
    return {
      totalOrders: orders.length,
      activeOrders: orders.filter((order) => ['PAID', 'SHIPPED', 'DELIVERED', 'PURCHASE_CONFIRMED'].includes(order.status)).length,
      pendingRefunds: orders.filter((order) => order.status === 'REFUND_REQUESTED').length,
    };
  }, [orders]);

  return (
    <div className="min-h-screen bg-mentor-bg px-4 py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-[32px] bg-mentor-surface p-7 shadow-sm">
          <p className="text-sm font-semibold text-mentor-primary">주문내역</p>
          <h1 className="mt-3 text-3xl font-bold text-mentor-text">구매 진행 상태를 한눈에 확인하세요.</h1>
          <p className="mt-3 text-sm leading-6 text-mentor-muted">
            배송 상태 확인과 주문 후속 액션을 같은 화면에서 처리할 수 있도록 실제 API 흐름에 맞춰 정리했습니다.
          </p>
        </section>

        {error && (
          <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
        )}

        <section className="grid gap-4 md:grid-cols-3">
          <SummaryCard label="전체 주문" value={summary.totalOrders} />
          <SummaryCard label="진행 중 주문" value={summary.activeOrders} />
          <SummaryCard label="환불 요청" value={summary.pendingRefunds} />
        </section>

        {loading ? (
          <div className="flex justify-center py-24">
            <span className="h-10 w-10 animate-spin rounded-full border-4 border-mentor-accent border-t-mentor-primary" />
          </div>
        ) : orders.length === 0 ? (
          <div className="rounded-[32px] bg-mentor-surface px-6 py-20 text-center shadow-sm">
            <p className="text-lg font-semibold text-mentor-text">주문 내역이 없습니다.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {orders.map((order) => (
              <article key={order.id} className="rounded-[28px] bg-mentor-surface p-6 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-base font-bold text-mentor-text">주문 #{order.id}</p>
                      <span className="rounded-full bg-mentor-accent px-3 py-1 text-xs font-semibold text-mentor-primary">
                        {ORDER_STATUS_LABELS[order.status] ?? order.status}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-mentor-muted">{formatDate(order.orderedAt)}</p>
                    <p className="mt-1 text-sm text-mentor-muted">
                      주문자 {order.ordererName ?? '이름 미기록'} · {formatPaymentMethod(order.paymentMethod)}
                    </p>
                    <p className="mt-1 text-sm text-mentor-muted">
                      {formatPostalAddress(order.postalCode, order.address) || order.address}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-mentor-text">{order.totalPrice.toLocaleString('ko-KR')}원</p>
                    <button
                      type="button"
                      onClick={() => handleOpenDetail(order.id)}
                      className="mt-3 rounded-full bg-mentor-bg px-4 py-2 text-sm font-semibold text-mentor-muted transition hover:bg-mentor-border"
                    >
                      상세 보기
                    </button>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  <ActionButton
                    loading={actionLoadingOrderId === order.id}
                    disabled={!order.purchaseConfirmEnabled}
                    label="구매 확정"
                    onClick={() =>
                      handleOrderAction(order.id, 'purchaseConfirm', '배송 완료 후 구매 확정')
                    }
                  />
                  <ActionButton
                    loading={actionLoadingOrderId === order.id}
                    disabled={!order.refundEnabled}
                    label="환불 요청"
                    onClick={() =>
                      setReasonModal({ orderId: order.id, actionType: 'refundRequest', title: '환불 요청 사유 선택', options: REFUND_REASON_OPTIONS })
                    }
                  />
                  <ActionButton
                    loading={actionLoadingOrderId === order.id}
                    disabled={!order.cancelEnabled}
                    label="주문 취소 요청"
                    onClick={() =>
                      setReasonModal({ orderId: order.id, actionType: 'cancel', title: '취소 요청 사유 선택', options: CANCEL_REASON_OPTIONS })
                    }
                  />
                </div>

                {order.lastActionReason && (
                  <p className="mt-4 rounded-2xl bg-mentor-bg px-4 py-3 text-sm text-mentor-muted">
                    최근 처리 사유: {order.lastActionReason}
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
      </div>

      {(selectedOrder || detailLoading) && (
        <OrderDetailModal
          order={selectedOrder}
          loading={detailLoading}
          onClose={() => setSelectedOrder(null)}
        />
      )}

      {reasonModal && (
        <ReasonSelectModal
          title={reasonModal.title}
          options={reasonModal.options}
          loading={actionLoadingOrderId === reasonModal.orderId}
          onConfirm={(reason) => {
            handleOrderAction(reasonModal.orderId, reasonModal.actionType, reason);
            setReasonModal(null);
          }}
          onClose={() => setReasonModal(null)}
        />
      )}
    </div>
  );
}

/**
 * 주문 상세 모달입니다.
 */
function OrderDetailModal({ order, loading, onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-[32px] bg-mentor-surface shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-mentor-border px-6 py-5">
          <h2 className="text-lg font-bold text-mentor-text">
            {order?.id ? `주문 #${order.id} 상세` : '주문 상세'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-mentor-bg px-3 py-1 text-sm font-semibold text-mentor-muted transition hover:bg-mentor-border"
          >
            닫기
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
          {loading && (
            <div className="flex justify-center py-16">
              <span className="h-8 w-8 animate-spin rounded-full border-4 border-mentor-accent border-t-mentor-primary" />
            </div>
          )}

          {!loading && order?.error && (
            <p className="py-12 text-center text-sm text-red-600">{order.error}</p>
          )}

          {!loading && order && !order.error && (
            <>
              <div className="rounded-3xl bg-mentor-bg p-5">
                <div className="grid gap-3 md:grid-cols-3">
                  <DetailTile label="주문 상태" value={ORDER_STATUS_LABELS[order.status] ?? order.status} />
                  <DetailTile label="주문 일시" value={formatDate(order.orderedAt)} />
                  <DetailTile label="총 결제 금액" value={`${order.totalPrice.toLocaleString('ko-KR')}원`} />
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <DetailTile label="주문자 이름" value={order.ordererName} />
                  <DetailTile label="주문자 연락처" value={order.ordererPhone} />
                  <DetailTile label="결제 수단" value={formatPaymentMethod(order.paymentMethod)} />
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <DetailTile label="우편번호" value={order.postalCode ?? '미기록'} />
                </div>
                <div className="mt-4 rounded-2xl bg-mentor-surface px-4 py-4">
                  <p className="text-xs text-mentor-muted">배송지</p>
                  <p className="mt-2 text-sm font-semibold text-mentor-text">
                    {formatPostalAddress(order.postalCode, order.address) || order.address}
                  </p>
                </div>
              </div>

              {order.items?.length > 0 && (
                <div className="mt-5 space-y-3">
                  {order.items.map((item, index) => (
                    <div key={`${item.bookId}-${index}`} className="rounded-2xl border border-mentor-border px-4 py-4">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold text-mentor-text">{item.bookTitle}</p>
                          <p className="mt-1 text-xs text-mentor-muted">
                            {item.price.toLocaleString('ko-KR')}원 × {item.quantity}권
                          </p>
                        </div>
                        <p className="text-sm font-bold text-mentor-text">
                          {(item.subtotal ?? item.price * item.quantity).toLocaleString('ko-KR')}원
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {order.lastActionReason && (
                <div className="mt-5 rounded-2xl bg-mentor-bg px-4 py-4">
                  <p className="text-xs text-mentor-muted">최근 처리 사유</p>
                  <p className="mt-2 text-sm font-semibold text-mentor-text">{order.lastActionReason}</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * 요약 카드입니다.
 */
function SummaryCard({ label, value }) {
  return (
    <article className="rounded-[28px] bg-mentor-surface p-6 shadow-sm">
      <p className="text-sm font-semibold text-mentor-muted">{label}</p>
      <p className="mt-3 text-3xl font-bold text-mentor-text">{value}</p>
    </article>
  );
}

/**
 * 주문 액션 버튼입니다.
 */
function ActionButton({ label, disabled, loading, onClick }) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      onClick={onClick}
      className="rounded-full bg-mentor-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-mentor-primary-dark disabled:cursor-not-allowed disabled:bg-mentor-bg disabled:text-mentor-muted"
    >
      {loading ? '처리 중...' : label}
    </button>
  );
}

/**
 * 상세 타일입니다.
 */
function DetailTile({ label, value }) {
  return (
    <div className="rounded-2xl bg-mentor-surface px-4 py-4">
      <p className="text-xs text-mentor-muted">{label}</p>
      <p className="mt-2 text-sm font-semibold text-mentor-text">{value}</p>
    </div>
  );
}

/**
 * 화면 표시용 주문 모델을 보정합니다.
 */
function buildOrderViewModel(order) {
  return {
    ...order,
    purchaseConfirmEnabled: order.status === 'DELIVERED',
    refundEnabled: order.status === 'DELIVERED' || order.status === 'PURCHASE_CONFIRMED',
    cancelEnabled: order.status === 'PENDING' || order.status === 'PAID',
    isCancelRequested: order.status === 'CANCEL_REQUESTED',
    isRefundRequested: order.status === 'REFUND_REQUESTED',
    lastActionReason: order.lastActionReason ?? '',
  };
}

/**
 * 날짜를 한국어 형식으로 변환합니다.
 */
function formatDate(value) {
  if (!value) {
    return '-';
  }

  return new Date(value).toLocaleString('ko-KR');
}

function formatPaymentMethod(paymentMethod) {
  if (paymentMethod === 'KAKAOPAY') {
    return '카카오페이';
  }

  return paymentMethod ?? '-';
}
