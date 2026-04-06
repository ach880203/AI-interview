import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCart, removeFromCart, updateCartItem } from '../../api/book';
import OrderProgressSteps from '../../components/bookstore/OrderProgressSteps';
import useCartStore from '../../store/cartStore';

/**
 * 장바구니 페이지입니다.
 *
 * [역할]
 * 담아 둔 상품과 수량을 최종 점검하고 다음 단계인 주문서로 이동하게 합니다.
 *
 * [중요]
 * 장바구니 단계와 주문서 단계를 분리해 두면 사용자가 현재 위치를 더 쉽게 이해할 수 있고,
 * 이후 결제 페이지를 실제 PG와 연결할 때도 화면 책임이 덜 섞입니다.
 */
export default function CartPage() {
  const navigate = useNavigate();
  const setCartCount = useCartStore((state) => state.setCartCount);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingId, setUpdatingId] = useState(null);
  const [removingId, setRemovingId] = useState(null);

  /**
   * 장바구니 목록을 불러옵니다.
   */
  const fetchCart = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await getCart();
      const cartItems = response.data?.data ?? response.data ?? [];
      setItems(cartItems);
      setCartCount(cartItems.length);
    } catch (requestError) {
      setError(
        requestError.response?.data?.error?.message ??
          '장바구니를 불러오지 못했습니다.'
      );
    } finally {
      setLoading(false);
    }
  }, [setCartCount]);

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  /**
   * 수량을 변경합니다.
   */
  async function handleQuantityChange(bookId, currentQuantity, delta) {
    const nextQuantity = currentQuantity + delta;
    if (nextQuantity < 1) {
      return;
    }

    setUpdatingId(bookId);

    try {
      await updateCartItem(bookId, { quantity: nextQuantity });
      setItems((previous) =>
        previous.map((item) =>
          item.bookId === bookId
            ? { ...item, quantity: nextQuantity, subtotal: item.price * nextQuantity }
            : item
        )
      );
    } catch (requestError) {
      setError(
        requestError.response?.data?.error?.message ??
          '수량 변경에 실패했습니다.'
      );
    } finally {
      setUpdatingId(null);
    }
  }

  /**
   * 장바구니 상품을 삭제합니다.
   */
  async function handleRemove(bookId) {
    setRemovingId(bookId);

    try {
      await removeFromCart(bookId);
      setItems((previous) => {
        const nextItems = previous.filter((item) => item.bookId !== bookId);
        setCartCount(nextItems.length);
        return nextItems;
      });
    } catch (requestError) {
      setError(
        requestError.response?.data?.error?.message ??
          '상품 삭제에 실패했습니다.'
      );
    } finally {
      setRemovingId(null);
    }
  }

  const itemTotalPrice = useMemo(() => {
    return items.reduce((sum, item) => sum + (item.subtotal ?? item.price * item.quantity), 0);
  }, [items]);

  /**
   * 전체 상품 수량을 요약합니다.
   */
  const totalQuantity = useMemo(() => {
    return items.reduce((sum, item) => sum + item.quantity, 0);
  }, [items]);

  return (
    <div className="min-h-screen bg-mentor-bg px-4 py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-[32px] bg-mentor-surface p-7 shadow-sm">
          <p className="text-sm font-semibold text-mentor-primary">장바구니</p>
          <h1 className="mt-3 text-3xl font-bold text-mentor-text">장바구니를 확인하고 주문서 단계로 이동하세요.</h1>
          <p className="mt-3 text-sm leading-6 text-mentor-muted">
            이 화면은 상품과 수량을 정리하는 1단계입니다. 주문자 정보와 배송지, 결제 수단은 다음 주문서 화면에서 입력합니다.
          </p>
        </section>

        <OrderProgressSteps currentStep={1} />

        {error && (
          <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
        )}

        {loading ? (
          <div className="flex justify-center py-24">
            <span className="h-10 w-10 animate-spin rounded-full border-4 border-mentor-accent border-t-mentor-primary" />
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-[32px] bg-mentor-surface px-6 py-20 text-center shadow-sm">
            <p className="text-lg font-semibold text-mentor-text">장바구니가 비어 있습니다.</p>
            <p className="mt-2 text-sm text-mentor-muted">도서 페이지에서 학습 과목에 맞는 책을 먼저 담아 보세요.</p>
            <button
              type="button"
              onClick={() => navigate('/books')}
              className="mt-6 rounded-full bg-mentor-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-mentor-primary-dark"
            >
              도서 보러 가기
            </button>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <section className="space-y-4">
              {items.map((item) => (
                <CartItemCard
                  key={item.cartItemId ?? item.bookId}
                  item={item}
                  isUpdating={updatingId === item.bookId}
                  isRemoving={removingId === item.bookId}
                  onQuantityChange={handleQuantityChange}
                  onRemove={handleRemove}
                />
              ))}
            </section>

            <aside className="space-y-4">
              <section className="rounded-[28px] bg-mentor-surface p-6 shadow-sm">
                <h2 className="text-lg font-bold text-mentor-text">주문 전 확인</h2>
                <p className="mt-1 text-sm text-mentor-muted">
                  주문서 화면으로 이동하면 주문자 정보, 배송지, 카카오페이 결제 진행 정보를 차례대로 입력할 수 있습니다.
                </p>

                <div className="mt-5 space-y-3 text-sm">
                  <SummaryRow label="상품 종류" value={`${items.length}권`} />
                  <SummaryRow label="총 수량" value={`${totalQuantity}개`} />
                  <SummaryRow label="상품 금액" value={`${itemTotalPrice.toLocaleString('ko-KR')}원`} />
                  <SummaryRow label="다음 단계" value="주문서 입력" />
                </div>
              </section>

              <section className="rounded-[28px] bg-mentor-primary p-6 text-white shadow-sm">
                <h2 className="text-lg font-bold">주문서로 이동</h2>
                <p className="mt-2 text-sm leading-6 text-white/80">
                  다음 화면에서 주문자명, 연락처, 배송지, 카카오페이 결제 진행 정보를 입력한 뒤 최종 결제를 진행합니다.
                </p>

                <button
                  type="button"
                  onClick={() => navigate('/orders/checkout')}
                  className="mt-5 w-full rounded-2xl bg-mentor-surface px-4 py-3 text-sm font-semibold text-mentor-text transition hover:bg-mentor-bg disabled:cursor-not-allowed disabled:opacity-60"
                >
                  주문서로 이동
                </button>
              </section>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * 장바구니 상품 카드입니다.
 */
function CartItemCard({ item, isUpdating, isRemoving, onQuantityChange, onRemove }) {
  const subtotal = item.subtotal ?? item.price * item.quantity;

  return (
    <article className="rounded-[28px] bg-mentor-surface p-5 shadow-sm">
      <div className="flex gap-4">
        <div className="h-28 w-20 flex-shrink-0 overflow-hidden rounded-2xl bg-mentor-bg">
          {item.coverUrl ? (
            <img src={item.coverUrl} alt={item.bookTitle} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-mentor-muted">책</div>
          )}
        </div>

        <div className="flex flex-1 flex-col justify-between">
          <div>
            <p className="text-base font-semibold text-mentor-text">{item.bookTitle}</p>
            <p className="mt-1 text-sm text-mentor-muted">{item.bookAuthor}</p>
            <p className="mt-2 text-sm font-semibold text-mentor-primary">
              {item.price.toLocaleString('ko-KR')}원
            </p>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isUpdating || isRemoving || item.quantity <= 1}
                onClick={() => onQuantityChange(item.bookId, item.quantity, -1)}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-mentor-border text-mentor-muted transition hover:bg-mentor-bg disabled:cursor-not-allowed disabled:opacity-40"
              >
                -
              </button>
              <span className="w-8 text-center text-sm font-semibold text-mentor-text">
                {isUpdating ? '...' : item.quantity}
              </span>
              <button
                type="button"
                disabled={isUpdating || isRemoving}
                onClick={() => onQuantityChange(item.bookId, item.quantity, 1)}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-mentor-border text-mentor-muted transition hover:bg-mentor-bg disabled:cursor-not-allowed disabled:opacity-40"
              >
                +
              </button>
            </div>

            <div className="flex items-center gap-3">
              <p className="text-lg font-bold text-mentor-text">{subtotal.toLocaleString('ko-KR')}원</p>
              <button
                type="button"
                disabled={isUpdating || isRemoving}
                onClick={() => onRemove(item.bookId)}
                className="rounded-full bg-mentor-bg px-3 py-2 text-xs font-semibold text-mentor-muted transition hover:bg-mentor-border disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isRemoving ? '삭제 중...' : '삭제'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

/**
 * 요약 행입니다.
 */
function SummaryRow({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-mentor-muted">{label}</span>
      <span className="font-semibold text-mentor-text">{value}</span>
    </div>
  );
}
