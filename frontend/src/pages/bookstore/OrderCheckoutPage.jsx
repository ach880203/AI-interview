import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getCart } from '../../api/book';
import OrderProgressSteps from '../../components/bookstore/OrderProgressSteps';
import { loadOrderCheckoutDraft, saveOrderCheckoutDraft } from '../../data/orderCheckoutStorage';
import useAuthStore from '../../store/authStore';
import AddressSearchDialog from '../../utils/AddressSearchDialog';
import { formatFullAddress } from '../../utils/addressUtils';
import { openPostcodeSearchProvider } from '../../utils/postcodeSearchProvider';

const DEFAULT_PAYMENT_METHOD = 'KAKAOPAY';

/**
 * 주문서 페이지입니다.
 *
 * [역할]
 * 장바구니에서 확정한 상품을 기준으로 주문자명, 연락처, 배송지, 결제 수단을 입력받아
 * 다음 단계인 결제 확인 페이지로 넘기는 역할을 맡습니다.
 *
 * [주의]
 * 여기서는 아직 실제 주문을 생성하지 않습니다.
 * 주문 생성은 결제 페이지에서 최종 확인 버튼을 눌렀을 때만 실행해
 * 사용자가 중간에 되돌아가도 주문 데이터가 섣불리 쌓이지 않게 합니다.
 */
export default function OrderCheckoutPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);

  /**
   * 이미 저장된 기본 배송지가 없으면 첫 주문에서 바로 저장하도록 기본값을 켭니다.
   *
   * [이유]
   * 초보 사용자 입장에서는 마이페이지를 한 번 더 거치지 않아도
   * 다음 주문서에 같은 주소가 자동 입력되는 편이 흐름이 더 자연스럽습니다.
   */
  const hasSavedShippingInfo = Boolean(
    user?.shippingPostalCode || user?.shippingAddress || user?.shippingDetailAddress
  );

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isAddressSearchOpen, setIsAddressSearchOpen] = useState(false);
  const [orderForm, setOrderForm] = useState(() => {
    const savedDraft = loadOrderCheckoutDraft();

    return {
      ordererName: savedDraft?.ordererName ?? '',
      ordererPhone: savedDraft?.ordererPhone ?? '',
      postalCode: savedDraft?.postalCode ?? '',
      address: savedDraft?.address ?? '',
      detailAddress: savedDraft?.detailAddress ?? '',
      paymentMethod: savedDraft?.paymentMethod ?? DEFAULT_PAYMENT_METHOD,
      saveShippingInfo: savedDraft?.saveShippingInfo ?? !hasSavedShippingInfo,
    };
  });

  /**
   * 로그인 사용자 정보가 이미 있으면 주문서 초안의 빈 칸을 먼저 채웁니다.
   *
   * [이유]
   * 주문서를 처음 여는 순간부터 이름과 연락처가 보이면
   * 사용자가 모든 정보를 다시 입력해야 한다는 부담이 줄어듭니다.
   */
  useEffect(() => {
    setOrderForm((previous) => ({
      ...previous,
      ordererName: previous.ordererName || user?.name || '',
      ordererPhone: previous.ordererPhone || user?.phone || '',
      postalCode: previous.postalCode || user?.shippingPostalCode || '',
      address: previous.address || user?.shippingAddress || '',
      detailAddress: previous.detailAddress || user?.shippingDetailAddress || '',
    }));
  }, [
    user?.name,
    user?.phone,
    user?.shippingPostalCode,
    user?.shippingAddress,
    user?.shippingDetailAddress,
  ]);

  /**
   * 현재 장바구니 항목을 주문서 기준 데이터로 불러옵니다.
   */
  const fetchCartItems = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await getCart();
      const cartItems = response.data?.data ?? response.data ?? [];
      setItems(cartItems);
    } catch (requestError) {
      setError(
        requestError.response?.data?.error?.message ??
          '주문서에 표시할 장바구니 정보를 불러오지 못했습니다.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCartItems();
  }, [fetchCartItems]);

  const itemTotalPrice = useMemo(() => {
    return items.reduce((sum, item) => sum + (item.subtotal ?? item.price * item.quantity), 0);
  }, [items]);

  const totalQuantity = useMemo(() => {
    return items.reduce((sum, item) => sum + item.quantity, 0);
  }, [items]);

  /**
   * 공통 주소 선택 대화상자에서 고른 주소를 주문서에 반영합니다.
   *
   * [의도]
   * 우편번호와 기본 주소를 한 번에 저장해 두면
   * 실제 주소 검색 공급자를 붙인 뒤에도 주문서 상태 구조를 다시 바꿀 필요가 없습니다.
   */
  function handleSelectAddress(selectedAddress) {
    setOrderForm((previous) => ({
      ...previous,
      postalCode: selectedAddress.postalCode,
      address: selectedAddress.roadAddress,
    }));
  }

  /**
   * 실제 우편번호 공급자를 먼저 열고, 실패하면 현재 프리셋 대화상자로 전환합니다.
   *
   * [이유]
   * 주소 검색 공급자를 붙이더라도 주문서 입력 흐름이 끊기지 않게
   * 실시간 검색 실패 시 곧바로 내부 주소 목록으로 이어지게 만듭니다.
   */
  function handleOpenAddressSearch() {
    openPostcodeSearchProvider({
      onSelect: handleSelectAddress,
      onFallback: () => setIsAddressSearchOpen(true),
    });
  }

  /**
   * 마이페이지에 저장한 기본 배송정보를 다시 불러옵니다.
   *
   * [이유]
   * 사용자가 주문서에서 값을 바꿨더라도, 저장된 기본값으로 쉽게 되돌릴 수 있어야 주문 흐름이 덜 헷갈립니다.
   */
  function handleApplySavedShippingInfo() {
    setOrderForm((previous) => ({
      ...previous,
      ordererName: user?.name || previous.ordererName,
      ordererPhone: user?.phone || previous.ordererPhone,
      postalCode: user?.shippingPostalCode || previous.postalCode,
      address: user?.shippingAddress || previous.address,
      detailAddress: user?.shippingDetailAddress || previous.detailAddress,
    }));
  }

  /**
   * 결제 페이지로 이동하기 전에 주문서 필수 입력값을 점검합니다.
   *
   * [중요]
   * 여기서 한 번 검증해 두면 결제 페이지에 도착한 뒤 빈 값 때문에 되돌아오는 상황을 줄일 수 있습니다.
   */
  function handleMoveToPaymentPage() {
    if (items.length === 0) {
      setError('주문할 상품이 없습니다. 장바구니부터 다시 확인해 주세요.');
      return;
    }

    if (!orderForm.ordererName.trim()) {
      setError('주문자 이름을 입력해 주세요.');
      return;
    }

    if (!orderForm.ordererPhone.trim()) {
      setError('주문자 연락처를 입력해 주세요.');
      return;
    }

    if (!orderForm.postalCode.trim()) {
      setError('우편번호를 포함한 기본 주소를 선택해 주세요.');
      return;
    }

    if (!orderForm.address.trim()) {
      setError('기본 배송지를 입력해 주세요.');
      return;
    }

    setError('');

    /**
     * 결제 페이지에서는 장바구니를 다시 조회하지 않고,
     * 주문서에서 확인한 상품과 입력값을 그대로 이어받아 최종 결제를 진행합니다.
     */
    saveOrderCheckoutDraft({
      ...orderForm,
      items: items.map((item) => ({
        bookId: item.bookId,
        bookTitle: item.bookTitle,
        bookAuthor: item.bookAuthor,
        quantity: item.quantity,
        price: item.price,
        subtotal: item.subtotal ?? item.price * item.quantity,
      })),
      totalQuantity,
      itemTotalPrice,
      shippingAddressLabel: formatFullAddress(
        orderForm.postalCode,
        orderForm.address,
        orderForm.detailAddress
      ),
      finalAddress: `${orderForm.address.trim()} ${orderForm.detailAddress.trim()}`.trim(),
    });

    navigate('/orders/payment');
  }

  return (
    <div className="min-h-screen bg-mentor-bg px-4 py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-[32px] bg-mentor-surface p-7 shadow-sm">
          <p className="text-sm font-semibold text-mentor-primary">주문서</p>
          <h1 className="mt-3 text-3xl font-bold text-mentor-text">주문자 정보와 배송지를 입력해 주세요.</h1>
          <p className="mt-3 text-sm leading-6 text-mentor-muted">
            장바구니에서 확인한 상품을 기준으로 주문자명, 연락처, 배송지, 결제 수단을 확정한 뒤 결제 단계로 이동합니다.
          </p>
        </section>

        <OrderProgressSteps currentStep={2} />

        {error && (
          <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
        )}

        {loading ? (
          <div className="flex justify-center py-24">
            <span className="h-10 w-10 animate-spin rounded-full border-4 border-mentor-accent border-t-mentor-primary" />
          </div>
        ) : items.length === 0 ? (
          <EmptyOrderCheckoutState />
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <section className="space-y-4">
              <section className="rounded-[28px] bg-mentor-surface p-6 shadow-sm">
                <h2 className="text-lg font-bold text-mentor-text">주문 상품 확인</h2>
                <p className="mt-1 text-sm text-mentor-muted">
                  결제 전 마지막으로 도서 목록과 수량을 확인합니다.
                </p>

                <div className="mt-5 space-y-3">
                  {items.map((item) => (
                    <CheckoutItemRow key={item.cartItemId ?? item.bookId} item={item} />
                  ))}
                </div>
              </section>

              <section className="rounded-[28px] bg-mentor-surface p-6 shadow-sm">
                <h2 className="text-lg font-bold text-mentor-text">주문자 정보 입력</h2>
                <p className="mt-1 text-sm text-mentor-muted">
                  주문 완료 안내와 배송 연락을 받을 수 있도록 실제 수령자 기준 정보로 입력해 주세요.
                </p>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <InputField
                    label="주문자 이름"
                    value={orderForm.ordererName}
                    onChange={(value) =>
                      setOrderForm((previous) => ({ ...previous, ordererName: value }))
                    }
                    placeholder="주문자 이름을 입력해 주세요."
                  />
                  <InputField
                    label="주문자 연락처"
                    value={orderForm.ordererPhone}
                    onChange={(value) =>
                      setOrderForm((previous) => ({ ...previous, ordererPhone: value }))
                    }
                    placeholder="010-1234-5678"
                  />
                </div>
              </section>

<section className="rounded-[28px] bg-mentor-surface p-6 shadow-sm">
                <h2 className="text-lg font-bold text-mentor-text">배송지 입력</h2>
                <p className="mt-1 text-sm text-mentor-muted">
                  주소 찾기 버튼을 눌러 카카오 우편번호 서비스로 도로명 주소를 검색해 주세요.
                </p>

                <div className="mt-5 space-y-4">
                  <div className="grid gap-4 lg:grid-cols-[160px_minmax(0,1fr)_auto] lg:items-end">
                    <InputField
                      label="우편번호"
                      value={orderForm.postalCode}
                      onChange={() => {}}
                      placeholder="주소 찾기로 선택해 주세요."
                      disabled
                    />
                    <InputField
                      label="기본 주소"
                      value={orderForm.address}
                      onChange={() => {}}
                      placeholder="주소 찾기로 기본 주소를 선택해 주세요."
                      disabled
                    />
                    <button
                      type="button"
                      onClick={handleOpenAddressSearch}
                      className="rounded-full bg-mentor-bg px-5 py-3 text-sm font-semibold text-mentor-primary transition hover:bg-mentor-border"
                    >
                      주소 찾기
                    </button>
                  </div>

                  <InputField
                    label="상세 주소"
                    value={orderForm.detailAddress}
                    onChange={(value) =>
                      setOrderForm((previous) => ({ ...previous, detailAddress: value }))
                    }
                    placeholder="동, 호수, 층수처럼 필요한 정보만 이어서 입력해 주세요."
                  />
                </div>

                {(orderForm.postalCode || orderForm.address) && (
                  <div className="mt-5 rounded-2xl bg-mentor-bg px-4 py-4">
                    <p className="text-sm font-semibold text-mentor-text">현재 배송지 미리보기</p>
                    <p className="mt-2 text-sm leading-6 text-mentor-muted">
                      {formatFullAddress(
                        orderForm.postalCode,
                        orderForm.address,
                        orderForm.detailAddress
                      ) || '주소를 선택해 주세요.'}
                    </p>
                  </div>
                )}

                <div className="mt-5 rounded-2xl border border-mentor-border bg-mentor-surface px-4 py-4">
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={orderForm.saveShippingInfo}
                      onChange={(event) =>
                        setOrderForm((previous) => ({
                          ...previous,
                          saveShippingInfo: event.target.checked,
                        }))
                      }
                      className="mt-1 h-4 w-4 rounded border-mentor-border text-mentor-primary focus:ring-mentor-accent"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-mentor-text">
                        이번 배송 정보를 기본 배송지로 저장
                      </span>
                      <span className="mt-1 block text-sm leading-6 text-mentor-muted">
                        주문이 정상 접수되면 마이페이지와 다음 주문서에서 같은 주소를 바로 불러옵니다.
                      </span>
                    </span>
                  </label>
                </div>

                {(user?.shippingPostalCode || user?.shippingAddress || user?.shippingDetailAddress) && (
                  <div className="mt-5 rounded-2xl bg-mentor-bg px-4 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-mentor-text">저장된 기본 배송정보</p>
                        <p className="mt-1 text-sm text-mentor-muted">
                          마이페이지에 저장한 주소를 다시 불러와 현재 주문서에 적용할 수 있습니다.
                        </p>
                        <p className="mt-2 text-sm font-semibold text-mentor-text">
                          {formatFullAddress(
                            user?.shippingPostalCode,
                            user?.shippingAddress,
                            user?.shippingDetailAddress
                          )}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleApplySavedShippingInfo}
                        className="rounded-full bg-mentor-surface px-4 py-2 text-sm font-semibold text-mentor-primary transition hover:bg-mentor-border"
                      >
                        기본 배송정보 다시 불러오기
                      </button>
                    </div>
                  </div>
                )}

              </section>
            </section>

            <aside className="space-y-4">
              <section className="rounded-[28px] bg-mentor-surface p-6 shadow-sm">
                <h2 className="text-lg font-bold text-mentor-text">결제 수단</h2>
                <p className="mt-1 text-sm text-mentor-muted">
                  현재 운영 기준은 카카오페이 단일 흐름으로 정리하고 있습니다.
                </p>

                <button
                  type="button"
                  className="mt-5 w-full rounded-2xl border border-mentor-primary bg-mentor-primary px-4 py-4 text-left text-white"
                >
                  <p className="text-sm font-semibold">카카오페이</p>
                  <p className="mt-1 text-xs leading-5 text-white/80">
                    결제 페이지에서 카카오페이 승인 흐름 기준으로 최종 결제를 진행합니다.
                  </p>
                </button>
              </section>

              <section className="rounded-[28px] bg-mentor-primary p-6 text-white shadow-sm">
                <h2 className="text-lg font-bold">주문서 요약</h2>
                <div className="mt-5 space-y-3 text-sm">
                  <CheckoutSummaryRow label="상품 종류" value={`${items.length}권`} />
                  <CheckoutSummaryRow label="총 수량" value={`${totalQuantity}개`} />
                  <CheckoutSummaryRow label="상품 금액" value={`${itemTotalPrice.toLocaleString('ko-KR')}원`} />
                  <CheckoutSummaryRow
                    label="기본 배송지 저장"
                    value={orderForm.saveShippingInfo ? '저장함' : '저장 안 함'}
                  />
                  <CheckoutSummaryRow label="결제 수단" value="카카오페이" />
                </div>

                <div className="mt-5 border-t border-white/10 pt-5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-white/70">최종 결제 예정 금액</span>
                    <span className="text-2xl font-bold">{itemTotalPrice.toLocaleString('ko-KR')}원</span>
                  </div>
                  <p className="mt-2 text-xs text-white/70">
                    실제 주문 생성은 다음 결제 확인 화면에서 한 번 더 검토한 뒤 진행됩니다.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleMoveToPaymentPage}
                  className="mt-5 w-full rounded-2xl bg-mentor-surface px-4 py-3 text-sm font-semibold text-mentor-text transition hover:bg-mentor-bg"
                >
                  결제 페이지로 이동
                </button>

                <Link
                  to="/cart"
                  className="mt-3 inline-flex w-full justify-center rounded-2xl border border-white/20 px-4 py-3 text-sm font-semibold text-white/90 transition hover:bg-white/10"
                >
                  장바구니로 돌아가기
                </Link>
              </section>
            </aside>
          </div>
        )}
        <AddressSearchDialog
          open={isAddressSearchOpen}
          title="배송지 주소 찾기"
          description="주문서에 사용할 기본 주소를 선택해주세요. 우편번호와 기본 주소가 함께 저장됩니다."
          onClose={() => setIsAddressSearchOpen(false)}
          onSelect={handleSelectAddress}
        />
      </div>
    </div>
  );
}

/**
 * 주문서에 표시하는 상품 요약 행입니다.
 */
function CheckoutItemRow({ item }) {
  const subtotal = item.subtotal ?? item.price * item.quantity;

  return (
    <article className="rounded-3xl border border-mentor-border bg-mentor-bg px-5 py-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-mentor-text">{item.bookTitle}</p>
          <p className="mt-1 text-sm text-mentor-muted">{item.bookAuthor}</p>
        </div>
        <p className="text-sm font-semibold text-mentor-primary">{subtotal.toLocaleString('ko-KR')}원</p>
      </div>
      <p className="mt-3 text-sm text-mentor-muted">수량 {item.quantity}권</p>
    </article>
  );
}

/**
 * 주문서 입력 필드입니다.
 */
function InputField({ label, value, onChange, placeholder, disabled = false }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-mentor-text">{label}</span>
      <input
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-2 w-full rounded-2xl border border-mentor-border px-4 py-3 text-sm outline-none transition focus:border-mentor-primary focus:ring-2 focus:ring-mentor-accent disabled:cursor-not-allowed disabled:bg-mentor-bg disabled:text-mentor-muted"
      />
    </label>
  );
}

/**
 * 주문서 요약 행입니다.
 */
function CheckoutSummaryRow({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-white/70">{label}</span>
      <span className="font-semibold text-white">{value}</span>
    </div>
  );
}

/**
 * 주문서 진입 시 장바구니가 비어 있는 경우의 안내 화면입니다.
 */
function EmptyOrderCheckoutState() {
  return (
    <section className="rounded-[32px] bg-mentor-surface px-6 py-20 text-center shadow-sm">
      <p className="text-lg font-semibold text-mentor-text">주문서에 담을 상품이 없습니다.</p>
      <p className="mt-2 text-sm text-mentor-muted">
        장바구니에 상품을 담은 뒤 주문서로 다시 이동해 주세요.
      </p>
      <Link
        to="/cart"
        className="mt-6 inline-flex rounded-full bg-mentor-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-mentor-primary-dark"
      >
        장바구니로 이동
      </Link>
    </section>
  );
}
