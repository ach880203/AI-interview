import { useCallback, useEffect, useMemo, useState } from 'react';
import * as authApi from '../api/auth';
import { Link, useSearchParams } from 'react-router-dom';
import * as profileApi from '../api/profile';
import * as bookApi from '../api/book';
import * as wishlistApi from '../api/wishlist';
import * as customerCenterApi from '../api/customerCenter';
import AddressSearchDialog from '../utils/AddressSearchDialog';
import { formatPostalAddress } from '../utils/addressUtils';
import { openPostcodeSearchProvider } from '../utils/postcodeSearchProvider';
import useAuthStore from '../store/authStore';
import { getAllMemos, addMemo, updateMemo, deleteMemo, deleteAllMemos, migrateOldMemo } from '../utils/memoStorage';
import {
  CANCEL_REASON_OPTIONS,
  MY_PAGE_MENU_ITEMS,
  PAYMENT_METHODS,
  REFUND_REASON_OPTIONS,
} from '../data/portalConfig';
import { ORDER_STATUS_LABELS } from '../data/orderStatusLabels';
import ReasonSelectModal from '../components/common/ReasonSelectModal';

const DEFAULT_SECTION = 'profile';

/**
 * 마이페이지입니다.
 *
 * [역할]
 * 회원 정보, 구매 내역, 문서 관리 바로가기, 찜목록, 문의하기를 한 화면 구조로 묶습니다.
 *
 * [중요]
 * 구매 확정, 환불 요청, 구매 취소는 실제 주문 API와 연결했습니다.
 * 프로필 저장과 고객센터 요약도 실제 API와 연결했고,
 * 찜목록만 아직 화면 구조 중심의 준비 상태로 남겨 두었습니다.
 */
export default function MyPage() {
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const [searchParams, setSearchParams] = useSearchParams();
  const activeSection = searchParams.get('section') ?? DEFAULT_SECTION;

  const [documents, setDocuments] = useState({
    resumes: [],
    coverLetters: [],
    jobPostings: [],
  });
  const [orders, setOrders] = useState([]);
  const [customerCenterSummary, setCustomerCenterSummary] = useState({
    totalCount: 0,
    waitingCount: 0,
    answeredCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [actionLoadingOrderId, setActionLoadingOrderId] = useState(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaveMessage, setProfileSaveMessage] = useState('');
  const [error, setError] = useState('');
  /* 기존 더미 초안은 아래에서 실데이터 초안으로 대체합니다.
  const [profileDraft, setProfileDraft] = useState({
    name: user?.name ?? '',
    email: user?.email ?? '',
    phone: '010-0000-0000',
    address: '서울 강남구 테헤란로 123',
  }); */
  const [profileDraft, setProfileDraft] = useState(() => buildProfileDraft(user));
  /**
   * 마이페이지 초기 데이터를 불러옵니다.
   */
  useEffect(() => {
    async function fetchMyPageData() {
      setLoading(true);
      setError('');

      try {
        const [myInfoResult, resumeResult, coverLetterResult, jobPostingResult, orderResult] =
          await Promise.all([
            authApi.getMe(),
            profileApi.getResumes(),
            profileApi.getCoverLetters(),
            profileApi.getJobPostings(),
            bookApi.getOrders(),
          ]);

        const myInfo = myInfoResult.data?.data ?? myInfoResult.data;
        setProfileDraft(buildProfileDraft(myInfo));
        setUser(myInfo);
        setProfileSaveMessage('');

        setDocuments({
          resumes: resumeResult.data.data ?? [],
          coverLetters: coverLetterResult.data.data ?? [],
          jobPostings: jobPostingResult.data.data ?? [],
        });

        setOrders((orderResult.data.data ?? []).map(buildOrderViewModel));

        try {
          /**
           * 마이페이지에서도 고객센터 현황을 바로 보여주면
           * 사용자가 문의 답변 상태를 찾으려고 메뉴를 여러 번 오갈 필요가 줄어듭니다.
           */
          const inquiryResult = await customerCenterApi.getMyCustomerCenterInquiries();
          const inquiries = inquiryResult.data.data ?? [];
          const answeredCount = inquiries.filter((inquiry) => inquiry.answered).length;

          setCustomerCenterSummary({
            totalCount: inquiries.length,
            answeredCount,
            waitingCount: Math.max(inquiries.length - answeredCount, 0),
          });
        } catch (supportError) {
          /**
           * 고객센터 요약은 보조 정보라서, 여기만 실패했다고 마이페이지 전체를 막지는 않습니다.
           * 대신 0건으로 두고 상세 화면에서 다시 확인할 수 있게 둡니다.
           */
          console.error('고객센터 요약 정보를 불러오지 못했습니다.', supportError);
          setCustomerCenterSummary({
            totalCount: 0,
            waitingCount: 0,
            answeredCount: 0,
          });
        }
      } catch (requestError) {
        setError(
          requestError.response?.data?.error?.message ??
            '마이페이지 데이터를 불러오지 못했습니다.'
        );
      } finally {
        setLoading(false);
      }
    }

    fetchMyPageData();
  }, []);

  /**
   * 헤더 드롭다운과 같은 메뉴 구성을 왼쪽 내비게이션에도 재사용합니다.
   */
  const sectionMenuItems = useMemo(() => {
    return MY_PAGE_MENU_ITEMS.map((item) => ({
      ...item,
      section: item.to.includes('?')
        ? new URLSearchParams(item.to.split('?')[1]).get('section')
        : null,
    }));
  }, []);

  /**
   * 주문 후속 액션을 실제 API에 반영합니다.
   */
  async function handleOrderAction(orderId, actionType, reason) {
    setActionLoadingOrderId(orderId);
    setError('');

    try {
      const requestMap = {
        purchaseConfirm: () => bookApi.confirmOrderPurchase(orderId, { reason }),
        refundRequest: () => bookApi.requestOrderRefund(orderId, { reason }),
        cancel: () => bookApi.cancelOrder(orderId, { reason }),
      };

      const response = await requestMap[actionType]();
      const updatedOrder = buildOrderViewModel(response.data?.data ?? response.data);

      setOrders((previous) =>
        previous.map((order) => (order.id === orderId ? { ...order, ...updatedOrder } : order))
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

  /**
   * 마이페이지에서 수정한 기본 프로필과 배송 정보를 저장합니다.
   *
   * [의도]
   * 주문서 자동 입력은 이 저장값을 그대로 사용하므로,
   * 저장 직후 authStore까지 함께 갱신해 다른 화면에서도 즉시 같은 값을 보게 합니다.
   */
  async function handleProfileSave() {
    if (!profileDraft.name.trim()) {
      setError('이름을 입력해주세요.');
      setProfileSaveMessage('');
      return;
    }

    setProfileSaving(true);
    setError('');
    setProfileSaveMessage('');

    try {
      const response = await authApi.updateMe({
        name: profileDraft.name.trim(),
        phone: profileDraft.phone.trim(),
        shippingPostalCode: profileDraft.shippingPostalCode.trim(),
        shippingAddress: profileDraft.shippingAddress.trim(),
        shippingDetailAddress: profileDraft.shippingDetailAddress.trim(),
      });

      const updatedUser = response.data?.data ?? response.data;
      setProfileDraft(buildProfileDraft(updatedUser));
      setUser(updatedUser);
      setProfileSaveMessage('기본 배송정보를 저장했습니다. 주문서에서 자동으로 불러옵니다.');
    } catch (requestError) {
      setError(
        requestError.response?.data?.error?.message ??
          '기본 배송정보를 저장하지 못했습니다.'
      );
    } finally {
      setProfileSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-mentor-bg px-4 py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* 헤더 섹션 — 흰색 카드 */}
        <section className="rounded-[28px] bg-mentor-surface p-7 shadow-[var(--shadow-card)]">
          <p className="text-sm font-semibold text-mentor-primary">마이페이지</p>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
            <div>
              {/* 제목 — mentor-text */}
              <h1 className="text-3xl font-bold text-mentor-text">
                {user?.name ? `${user.name}님의 작업 공간` : '내 작업 공간'}
              </h1>
              <p className="mt-2 text-sm text-mentor-muted">
                구매 이력, 문서 자산, 문의 내역을 한 곳에서 관리할 수 있도록 묶었습니다.
              </p>
            </div>
            {/* 구독 버튼 — mentor-primary */}
            <Link
              to="/subscription"
              className="rounded-full bg-mentor-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-mentor-primary-dark"
            >
              구독 요금 보기
            </Link>
          </div>
        </section>

        {error && (
          <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-mentor-danger">
            {error}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          {/* 사이드바 — 흰색 카드 */}
          <aside className="rounded-3xl bg-mentor-surface p-4 shadow-[var(--shadow-card)]">
            <nav className="space-y-2">
              {sectionMenuItems.map((item) => (
                item.section ? (
                  <button
                    key={item.to}
                    type="button"
                    onClick={() => setSearchParams({ section: item.section })}
                    className={`w-full rounded-2xl px-4 py-3 text-left text-sm font-semibold transition ${
                      activeSection === item.section
                        ? 'bg-mentor-primary text-white'  /* 활성 탭 — mentor-primary */
                        : 'text-mentor-muted hover:bg-mentor-bg'  /* 비활성 탭 */
                    }`}
                  >
                    {item.label}
                  </button>
                ) : (
                  <Link
                    key={item.to}
                    to={item.to}
                    className="block w-full rounded-2xl px-4 py-3 text-left text-sm font-semibold text-mentor-muted transition hover:bg-mentor-bg"
                  >
                    {item.label}
                  </Link>
                )
              ))}
            </nav>
          </aside>

          <div className="space-y-6">
            {loading ? (
              <div className="flex justify-center py-20">
                {/* 로딩 스피너 — mentor 색상 */}
                <span className="h-8 w-8 animate-spin rounded-full border-4 border-mentor-accent border-t-mentor-primary" />
              </div>
            ) : (
              <>
                {activeSection === 'profile' && (
                  <ProfileSection
                    profileDraft={profileDraft}
                    onChange={setProfileDraft}
                    onSave={handleProfileSave}
                    saving={profileSaving}
                    saveMessage={profileSaveMessage}
                  />
                )}
                {activeSection === 'orders' && (
                  <OrderSection
                    orders={orders}
                    actionLoadingOrderId={actionLoadingOrderId}
                    onOrderAction={handleOrderAction}
                  />
                )}
                {activeSection === 'resumes' && (
                  <DocumentSection
                    title="내 이력서"
                    description="면접 시작 메뉴와 바로 연결되는 이력서 자산입니다."
                    items={documents.resumes}
                    emptyText="등록된 이력서가 없습니다."
                    to="/profile/resume"
                  />
                )}
                {activeSection === 'cover-letters' && (
                  <DocumentSection
                    title="내 자기소개서"
                    description="면접 질문 품질을 높이는 자기소개서 자산입니다."
                    items={documents.coverLetters}
                    emptyText="등록된 자기소개서가 없습니다."
                    to="/profile/cover-letter"
                  />
                )}
                {activeSection === 'job-postings' && (
                  <DocumentSection
                    title="내 공고"
                    description="지원 공고를 등록하면 면접 질문이 더 구체적으로 맞춰집니다."
                    items={documents.jobPostings}
                    emptyText="등록된 채용공고가 없습니다."
                    to="/profile/job-posting"
                  />
                )}
                {activeSection === 'memos' && <MemoSection />}
                {activeSection === 'wishlist' && <WishlistSection />}
                {activeSection === 'inquiries' && (
                  <CustomerCenterGuideSection summary={customerCenterSummary} />
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 기본 프로필 수정 섹션입니다.
 */
function LegacyProfileSection({ profileDraft, onChange }) {
  return (
    /* 프로필 수정 — mentor-surface(흰색) 카드 */
    <section className="rounded-3xl bg-mentor-surface p-6 shadow-[var(--shadow-card)]">
      <h2 className="text-xl font-bold text-mentor-text">내 정보 수정</h2>
      <p className="mt-1 text-sm text-mentor-muted">
        실제 저장 API가 준비되면 현재 입력 구조를 그대로 연결할 수 있도록 필드를 미리 정리했습니다.
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Field
          label="이름"
          value={profileDraft.name}
          onChange={(value) => onChange({ ...profileDraft, name: value })}
        />
        <Field
          label="이메일"
          value={profileDraft.email}
          onChange={(value) => onChange({ ...profileDraft, email: value })}
        />
        <Field
          label="연락처"
          value={profileDraft.phone}
          onChange={(value) => onChange({ ...profileDraft, phone: value })}
        />
        <Field
          label="주소"
          value={profileDraft.address}
          onChange={(value) => onChange({ ...profileDraft, address: value })}
        />
      </div>

      {/* 안내 박스 — mentor-bg 배경 */}
      <div className="mt-6 rounded-2xl bg-mentor-bg px-4 py-4 text-sm text-mentor-muted">
        현재 단계에서는 화면 편집 구조를 먼저 완성했습니다. 회원 정보 저장 API가 연결되면 입력값 저장만 추가하면 됩니다.
      </div>
    </section>
  );
}

/**
 * 구매 내역 섹션입니다.
 */
/**
 * 마이페이지에서 실제로 사용하는 기본 프로필/배송 정보 섹션입니다.
 *
 * [주의]
 * 기존 더미 섹션은 참고용으로 남겨 두고, 이 함수가 실제 저장 흐름을 담당합니다.
 */
function ProfileSection({ profileDraft, onChange, onSave, saving, saveMessage }) {
  const [isAddressSearchOpen, setIsAddressSearchOpen] = useState(false);

  /**
   * 마이페이지에서 선택한 주소를 기본 배송정보 초안에 반영합니다.
   *
   * [이유]
   * 주문서와 같은 선택 결과 구조를 재사용해야
   * 나중에 실제 주소 검색 공급자를 붙여도 화면마다 저장 형식이 달라지지 않습니다.
   */
  function handleSelectShippingAddress(selectedAddress) {
    onChange({
      ...profileDraft,
      shippingPostalCode: selectedAddress.postalCode,
      shippingAddress: selectedAddress.roadAddress,
    });
  }

  /**
   * 실시간 우편번호 검색을 먼저 시도하고, 실패하면 현재 대화상자로 내려옵니다.
   *
   * [이유]
   * 외부 스크립트가 막혀도 기본 배송지 저장 기능은 계속 살아 있어야 해서
   * 한 버튼 안에서 실시간 검색과 내부 대안을 함께 연결합니다.
   */
  function handleOpenAddressSearch() {
    openPostcodeSearchProvider({
      onSelect: handleSelectShippingAddress,
      onFallback: () => setIsAddressSearchOpen(true),
    });
  }

  return (
    <>
      <section className="rounded-3xl bg-mentor-surface p-6 shadow-[var(--shadow-card)]">
        <h2 className="text-xl font-bold text-mentor-text">내 정보와 기본 배송정보</h2>
        <p className="mt-1 text-sm text-mentor-muted">
          여기에서 저장한 이름, 연락처, 기본 배송지는 주문서에서 자동으로 먼저 채워집니다.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Field
            label="이름"
            value={profileDraft.name}
            onChange={(value) => onChange({ ...profileDraft, name: value })}
          />
          <Field
            label="이메일"
            value={profileDraft.email}
            onChange={() => {}}
            disabled
          />
          <Field
            label="연락처"
            value={profileDraft.phone}
            onChange={(value) => onChange({ ...profileDraft, phone: value })}
          />
          <Field
            label="우편번호"
            value={profileDraft.shippingPostalCode}
            onChange={() => {}}
            disabled
            placeholder="주소 찾기로 선택해주세요."
          />
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <Field
            label="기본 주소"
            value={profileDraft.shippingAddress}
            onChange={() => {}}
            disabled
            placeholder="주소 찾기로 기본 주소를 선택해주세요."
          />
          <button
            type="button"
            onClick={handleOpenAddressSearch}
            className="rounded-full bg-mentor-bg px-5 py-3 text-sm font-semibold text-mentor-primary transition hover:bg-mentor-border"
          >
            주소 찾기
          </button>
        </div>

        <div className="mt-4">
          <Field
            label="상세 주소"
            value={profileDraft.shippingDetailAddress}
            onChange={(value) => onChange({ ...profileDraft, shippingDetailAddress: value })}
            placeholder="동, 호수, 층수처럼 필요한 정보만 이어서 입력해주세요."
          />
        </div>

        {(profileDraft.shippingPostalCode || profileDraft.shippingAddress) && (
          <div className="mt-6 rounded-2xl bg-mentor-bg px-4 py-4 text-sm text-mentor-muted">
            <p className="font-semibold text-mentor-text">기본 배송지 미리보기</p>
            <p className="mt-2 leading-6">
              {formatPostalAddress(
                profileDraft.shippingPostalCode,
                profileDraft.shippingAddress
              ) || '주소를 선택해주세요.'}
            </p>
          </div>
        )}

        <div className="mt-6 rounded-2xl bg-mentor-bg px-4 py-4 text-sm text-mentor-muted">
          주문자 이름과 연락처는 기본값으로 자동 입력되지만, 주문서에서 건별로 다시 수정할 수도 있습니다.
        </div>

        {saveMessage && (
          <div className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {saveMessage}
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="rounded-full bg-mentor-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-mentor-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? '저장 중...' : '기본 배송정보 저장'}
          </button>
          <p className="text-sm text-mentor-muted">
            이메일은 로그인 기준 정보라서 여기에서는 읽기 전용으로 보여줍니다.
          </p>
        </div>
      </section>

      <AddressSearchDialog
        open={isAddressSearchOpen}
        title="기본 배송지 찾기"
        description="마이페이지에 저장할 기본 배송지를 선택해주세요. 주문서 자동 입력에도 같은 주소가 사용됩니다."
        onClose={() => setIsAddressSearchOpen(false)}
        onSelect={handleSelectShippingAddress}
      />
    </>
  );
}

function OrderSection({ orders, actionLoadingOrderId, onOrderAction }) {
  const [reasonModal, setReasonModal] = useState(null);

  return (
    /* 구매내역 — mentor-surface 카드 */
    <section className="space-y-4 rounded-3xl bg-mentor-surface p-6 shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-mentor-text">구매내역확인</h2>
          <p className="mt-1 text-sm text-mentor-muted">
            배송 상태 확인, 구매 확정, 환불 요청, 구매 취소 흐름을 한 곳에서 관리합니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {PAYMENT_METHODS.map((method) => (
            <span
              key={method.key}
              className="rounded-full bg-mentor-bg px-3 py-1 text-xs font-semibold text-mentor-muted"
            >
              {method.label} 준비
            </span>
          ))}
        </div>
      </div>

      {orders.length === 0 && (
        <div className="rounded-2xl border border-dashed border-mentor-border px-6 py-14 text-center">
          <p className="text-sm text-mentor-muted">구매 내역이 아직 없습니다.</p>
        </div>
      )}

      {orders.map((order) => (
        <article key={order.id} className="rounded-3xl border border-mentor-border p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-mentor-text">{buildOrderTitle(order)}</p>
              <p className="mt-1 text-sm text-mentor-muted">{formatDate(order.orderedAt)}</p>
              <p className="mt-1 text-sm text-mentor-muted">
                {formatPostalAddress(order.postalCode, order.address) || order.address}
              </p>
            </div>
            <div className="text-right">
              {/* 주문 상태 배지 — mentor-accent 배경 */}
              <span className="rounded-full bg-mentor-accent px-3 py-1 text-xs font-semibold text-mentor-primary">
                {ORDER_STATUS_LABELS[order.status] ?? order.status}
              </span>
              <p className="mt-2 text-lg font-bold text-mentor-text">
                {order.totalPrice.toLocaleString('ko-KR')}원
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <PolicyCard
              label="구매 확정"
              value={order.purchaseConfirmEnabled ? '가능' : '대기'}
              description="배송 완료 시 활성화되며 7일 후 자동 확정 처리됩니다."
            />
            <PolicyCard
              label="환불 요청"
              value={order.refundEnabled ? '가능' : '불가'}
              description="구매 확정 전까지만 요청할 수 있도록 설계했습니다."
            />
            <PolicyCard
              label="구매 취소"
              value={order.cancelEnabled ? '가능' : '불가'}
              description="배송 전 단계에서만 취소할 수 있도록 분리했습니다."
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <ActionButton
              loading={actionLoadingOrderId === order.id}
              disabled={!order.purchaseConfirmEnabled}
              label="구매 확정"
              onClick={() =>
                onOrderAction(order.id, 'purchaseConfirm', '배송 완료 후 구매를 확정했습니다.')
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
              label={order.status === 'PENDING' ? '주문 취소' : '주문 취소 요청'}
              onClick={() =>
                setReasonModal({
                  orderId: order.id,
                  actionType: 'cancel',
                  title: order.status === 'PENDING' ? '주문 취소 사유 선택' : '취소 요청 사유 선택',
                  options: CANCEL_REASON_OPTIONS,
                })
              }
            />
          </div>

          {order.lastActionReason && (
            /* 최근 처리 사유 — mentor-bg 배경 */
            <p className="mt-3 rounded-2xl bg-mentor-bg px-4 py-3 text-sm text-mentor-muted">
              최근 처리 사유: {order.lastActionReason}
            </p>
          )}
        </article>
      ))}

      {reasonModal && (
        <ReasonSelectModal
          title={reasonModal.title}
          options={reasonModal.options}
          loading={actionLoadingOrderId === reasonModal.orderId}
          onConfirm={(reason) => {
            onOrderAction(reasonModal.orderId, reasonModal.actionType, reason);
            setReasonModal(null);
          }}
          onClose={() => setReasonModal(null)}
        />
      )}
    </section>
  );
}

/**
 * 문서 목록 섹션입니다.
 */
function DocumentSection({ title, description, items, emptyText, to }) {
  return (
    /* 문서 섹션 — mentor-surface 카드 */
    <section className="rounded-3xl bg-mentor-surface p-6 shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-mentor-text">{title}</h2>
          <p className="mt-1 text-sm text-mentor-muted">{description}</p>
        </div>
        {/* 관리 버튼 — mentor-primary */}
        <Link
          to={to}
          className="rounded-full bg-mentor-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-mentor-primary-dark"
        >
          관리하러 가기
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-mentor-border px-6 py-14 text-center">
          <p className="text-sm text-mentor-muted">{emptyText}</p>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {items.map((item) => (
            <div key={item.id} className="rounded-2xl border border-mentor-border px-4 py-4">
              <p className="text-sm font-semibold text-mentor-text">
                {item.title ?? (item.company ? `${item.company} · ${item.position ?? ''}` : `문서 #${item.id}`)}
              </p>
              <p className="mt-1 text-xs text-mentor-muted">{formatDate(item.updatedAt ?? item.createdAt)}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * 찜목록 섹션입니다.
 * 실제 찜 API와 연결하여 도서 찜 목록을 보여줍니다.
 */
function WishlistSection() {
  const user = useAuthStore((state) => state.user);
  const [wishlistItems, setWishlistItems] = useState([]);
  const [loadingWishlist, setLoadingWishlist] = useState(true);
  const [removingId, setRemovingId] = useState(null);

  useEffect(() => {
    async function fetchWishlist() {
      setLoadingWishlist(true);
      if (!user?.email) {
        setWishlistItems([]);
        setLoadingWishlist(false);
        return;
      }
      try {
        const res = await wishlistApi.getMyWishlist();
        setWishlistItems(res.data.data ?? []);
      } catch {
        setWishlistItems([]);
      } finally {
        setLoadingWishlist(false);
      }
    }
    fetchWishlist();
  }, [user?.email]);

  async function handleRemoveWishlist(bookId) {
    setRemovingId(bookId);
    try {
      await wishlistApi.toggleWishlist(bookId);
      setWishlistItems((prev) => prev.filter((item) => item.bookId !== bookId));
    } catch {
      // 실패 시 조용히 무시
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <section className="rounded-3xl bg-mentor-surface p-6 shadow-[var(--shadow-card)]">
      <h2 className="text-xl font-bold text-mentor-text">내 찜목록</h2>
      <p className="mt-1 text-sm text-mentor-muted">
        도서 스토어에서 찜한 도서가 여기에 표시됩니다.
      </p>

      {loadingWishlist ? (
        <div className="mt-6 flex justify-center py-10">
          <span className="h-8 w-8 animate-spin rounded-full border-4 border-mentor-accent border-t-mentor-primary" />
        </div>
      ) : wishlistItems.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-mentor-border px-6 py-14 text-center">
          <p className="text-sm text-mentor-muted">찜한 도서가 아직 없습니다.</p>
          <Link
            to="/books"
            className="mt-3 inline-block rounded-full bg-mentor-accent px-4 py-2 text-sm font-semibold text-mentor-primary transition hover:bg-mentor-primary/10"
          >
            도서 둘러보기
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {wishlistItems.map((item) => (
            <article key={item.id} className="rounded-3xl border border-mentor-border p-5 transition hover:border-mentor-primary hover:shadow-md">
              <div className="flex items-start justify-between gap-2">
                {/* 클릭 시 도서 상세 페이지로 이동 */}
                <Link to={`/books/${item.bookId}`} className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-mentor-text">{item.bookTitle}</p>
                  <p className="mt-1 text-xs text-mentor-muted">{item.bookAuthor}</p>
                  {item.bookPublisher && (
                    <p className="mt-0.5 text-xs text-mentor-muted">{item.bookPublisher}</p>
                  )}
                </Link>
                <button
                  type="button"
                  onClick={() => handleRemoveWishlist(item.bookId)}
                  disabled={removingId === item.bookId}
                  className="shrink-0 rounded-full p-1.5 text-red-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                  title="찜 해제"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth={1}>
                    <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
                  </svg>
                </button>
              </div>
              <p className="mt-3 text-sm font-bold text-mentor-primary">
                {item.bookPrice?.toLocaleString('ko-KR')}원
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * 문의하기 CRUD 섹션입니다.
 */
/**
 * 고객센터 안내 섹션입니다.
 *
 * [의도]
 * 예전 마이페이지 임시 문의 흐름 대신, FAQ와 문의 내역을 고객센터 한 곳으로 모아
 * 사용자 화면과 관리자 화면이 같은 데이터를 보도록 안내합니다.
 */
function CustomerCenterGuideSection({ summary }) {
  const totalCount = summary?.totalCount ?? 0;
  const waitingCount = summary?.waitingCount ?? 0;
  const answeredCount = summary?.answeredCount ?? 0;

  return (
    <section className="rounded-3xl bg-mentor-surface p-6 shadow-[var(--shadow-card)]">
      <h2 className="text-xl font-bold text-mentor-text">고객센터</h2>
      <p className="mt-1 text-sm text-mentor-muted">
        자주 묻는 질문 확인, 문의 등록, 문의 답변 상태 확인은 고객센터에서 한 번에 관리합니다.
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <PolicyCard
          label="FAQ 확인"
          value="바로 확인"
          description="관리자가 정리한 자주 묻는 질문을 먼저 보고 바로 해결할 수 있습니다."
        />
        <PolicyCard
          label="문의 등록"
          value="한 곳에서 작성"
          description="문의 제목과 내용을 남기면 고객센터 문의 내역과 관리자 화면에 같이 반영됩니다."
        />
        <PolicyCard
          label="답변 상태"
          value="같은 흐름에서 확인"
          description="답변 대기와 답변 완료 상태를 고객센터 화면 하나에서 이어서 확인할 수 있습니다."
        />
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl bg-mentor-bg px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-mentor-muted">
            고객센터 문의
          </p>
          <p className="mt-2 text-lg font-bold text-mentor-text">{totalCount}건</p>
          <p className="mt-2 text-sm text-mentor-muted">
            마이페이지에서도 지금까지 남긴 문의 수를 바로 확인할 수 있게 연결했습니다.
          </p>
        </div>
        <div className="rounded-2xl bg-mentor-bg px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-mentor-muted">
            답변 대기
          </p>
          <p className="mt-2 text-lg font-bold text-mentor-text">{waitingCount}건</p>
          <p className="mt-2 text-sm text-mentor-muted">
            아직 답변이 등록되지 않은 문의만 따로 모아 보여줍니다.
          </p>
        </div>
        <div className="rounded-2xl bg-mentor-bg px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-mentor-muted">
            답변 완료
          </p>
          <p className="mt-2 text-lg font-bold text-mentor-text">{answeredCount}건</p>
          <p className="mt-2 text-sm text-mentor-muted">
            관리자 답변이 달린 문의 수를 따로 보여줘서 확인 경로를 줄였습니다.
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-3xl bg-mentor-bg p-5">
        <p className="text-sm leading-6 text-mentor-muted">
          마이페이지의 임시 문의 기능은 고객센터 기준으로 정리했습니다. 아래 버튼으로 이동하면 FAQ와 문의 내역을 함께 확인할 수 있습니다.
        </p>
        <Link
          to="/support"
          className="mt-4 inline-flex rounded-full bg-mentor-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-mentor-primary-dark"
        >
          고객센터로 이동
        </Link>
      </div>
    </section>
  );
}

/**
 * 입력 필드입니다.
 */
/**
 * 사용자 응답을 마이페이지 프로필 입력용 상태로 정리합니다.
 *
 * [이유]
 * 응답 필드 이름과 화면 상태 이름을 맞춰 두면 저장 후 다시 채울 때 같은 함수를 재사용할 수 있습니다.
 */
function buildProfileDraft(userInfo) {
  return {
    name: userInfo?.name ?? '',
    email: userInfo?.email ?? '',
    phone: userInfo?.phone ?? '',
    shippingPostalCode: userInfo?.shippingPostalCode ?? '',
    shippingAddress: userInfo?.shippingAddress ?? '',
    shippingDetailAddress: userInfo?.shippingDetailAddress ?? '',
  };
}

function Field({ label, value, onChange, disabled = false, placeholder = '' }) {
  return (
    <label className="block">
      {/* 레이블 — mentor-text */}
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
 * 여러 줄 입력 필드입니다.
 */
function TextAreaField({ label, value, onChange }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-mentor-text">{label}</span>
      <textarea
        rows={5}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-2xl border border-mentor-border px-4 py-3 text-sm outline-none transition focus:border-mentor-primary focus:ring-2 focus:ring-mentor-accent"
      />
    </label>
  );
}

/**
 * 정책 안내용 작은 카드입니다.
 */
function PolicyCard({ label, value, description }) {
  return (
    /* 정책 카드 — mentor-bg 배경 */
    <div className="rounded-2xl bg-mentor-bg px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-mentor-muted">{label}</p>
      <p className="mt-2 text-lg font-bold text-mentor-text">{value}</p>
      <p className="mt-2 text-sm leading-6 text-mentor-muted">{description}</p>
    </div>
  );
}

/**
 * 주문 액션 버튼입니다.
 */
function ActionButton({ label, disabled, loading, onClick }) {
  return (
    /* 주문 액션 버튼 — mentor-primary, 비활성 시 mentor-bg */
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
 * 주문 데이터를 화면 표시용 모델로 보정합니다.
 */
function buildOrderViewModel(order) {
  return {
    ...order,
    purchaseConfirmEnabled: order.status === 'DELIVERED',
    refundEnabled: order.status === 'DELIVERED' || order.status === 'PURCHASE_CONFIRMED',
    // 마이페이지에서도 결제 대기와 결제 완료 상태에서만 취소 버튼을 열어 둡니다.
    cancelEnabled: ['PENDING', 'PAID'].includes(order.status),
    lastActionReason: order.lastActionReason ?? '',
  };
}

/**
 * 구매내역 카드 제목을 대표 상품명 중심으로 보여 줍니다.
 *
 * [표시 규칙]
 * - 한 권 주문: 상품명만 표시
 * - 여러 권 주문: 대표 상품명 외 N권
 * 대표 상품명이 없을 때만 예전처럼 주문 번호로 되돌아갑니다.
 */
function buildOrderTitle(order) {
  const primaryBookTitle = order.primaryBookTitle?.trim();
  const itemCount = Number(order.itemCount ?? 0);

  if (!primaryBookTitle) {
    return `주문 #${order.id}`;
  }

  if (itemCount <= 1) {
    return primaryBookTitle;
  }

  return `${primaryBookTitle} 외 ${itemCount - 1}권`;
}

/**
 * 날짜를 한국어 형식으로 보여 줍니다.
 */
function formatDate(value) {
  if (!value) {
    return '-';
  }

  return new Date(value).toLocaleString('ko-KR');
}

/**
 * 메모장 섹션 — 전체 메모 목록 조회, 편집, 삭제
 */
function MemoSection() {
  const user = useAuthStore((state) => state.user);
  const userStorageKey = user?.email ?? 'anonymous';
  const [memos, setMemos] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [newText, setNewText] = useState('');

  const refresh = useCallback(() => {
    migrateOldMemo(userStorageKey);
    setMemos(getAllMemos(userStorageKey));
  }, [userStorageKey]);

  useEffect(() => { refresh(); }, [refresh]);

  const handleAdd = useCallback(() => {
    if (!newText.trim()) return;
    addMemo(newText.trim(), userStorageKey);
    setNewText('');
    refresh();
  }, [newText, refresh, userStorageKey]);

  const handleDelete = useCallback((id) => {
    deleteMemo(id, userStorageKey);
    if (editingId === id) setEditingId(null);
    refresh();
  }, [editingId, refresh, userStorageKey]);

  const handleDeleteAll = useCallback(() => {
    if (!confirm('모든 메모를 삭제하시겠습니까?')) return;
    deleteAllMemos(userStorageKey);
    setEditingId(null);
    refresh();
  }, [refresh, userStorageKey]);

  const handleEditStart = useCallback((memo) => {
    setEditingId(memo.id);
    setEditText(memo.text);
  }, []);

  const handleEditSave = useCallback(() => {
    if (!editText.trim()) return;
    updateMemo(editingId, editText.trim(), userStorageKey);
    setEditingId(null);
    refresh();
  }, [editingId, editText, refresh, userStorageKey]);

  return (
    <section className="rounded-3xl bg-mentor-surface p-6 shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-mentor-text">내 메모장</h2>
          <p className="mt-1 text-sm text-mentor-muted">
            대시보드 메모 위젯에서 작성한 메모를 여기서 모아 볼 수 있습니다.
          </p>
        </div>
        {memos.length > 0 && (
          <button
            type="button"
            onClick={handleDeleteAll}
            className="rounded-xl px-3 py-1.5 text-xs font-semibold text-mentor-danger hover:bg-red-50 transition-colors"
          >
            전체 삭제
          </button>
        )}
      </div>

      {/* 새 메모 입력 */}
      <div className="mt-5 flex gap-2">
        <input
          type="text"
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="새 메모를 입력하세요..."
          className="flex-1 rounded-xl border border-mentor-border bg-mentor-bg/50 px-4 py-2.5 text-sm text-mentor-text placeholder:text-mentor-muted/50 focus:border-mentor-primary focus:outline-none focus:ring-1 focus:ring-mentor-primary/30"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!newText.trim()}
          className="rounded-xl bg-mentor-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-mentor-primary/90 disabled:opacity-50"
        >
          추가
        </button>
      </div>

      {/* 메모 목록 */}
      {memos.length === 0 ? (
        <div className="mt-8 flex flex-col items-center gap-2 py-10 text-center">
          <svg className="h-10 w-10 text-mentor-muted/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
          </svg>
          <p className="text-sm font-semibold text-mentor-muted">메모가 없습니다.</p>
          <p className="text-xs text-mentor-muted/70">대시보드 메모 위젯이나 위 입력창에서 작성해 보세요.</p>
        </div>
      ) : (
        <ul className="mt-5 space-y-3">
          {memos.map((memo) => (
            <li
              key={memo.id}
              className="rounded-2xl border border-mentor-border bg-mentor-bg/30 p-4 transition hover:border-mentor-primary/30"
            >
              {editingId === memo.id ? (
                <div className="flex flex-col gap-2">
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="min-h-[80px] resize-none rounded-xl border border-mentor-border bg-white p-3 text-sm text-mentor-text focus:border-mentor-primary focus:outline-none focus:ring-1 focus:ring-mentor-primary/30"
                    autoFocus
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="rounded-lg px-3 py-1.5 text-xs font-medium text-mentor-muted hover:bg-mentor-bg transition-colors"
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      onClick={handleEditSave}
                      disabled={!editText.trim()}
                      className="rounded-lg bg-mentor-primary px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-mentor-primary/90 disabled:opacity-50"
                    >
                      저장
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="whitespace-pre-wrap text-sm text-mentor-text leading-relaxed">
                    {memo.text || <span className="italic text-mentor-muted">(빈 메모)</span>}
                  </p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs text-mentor-muted">
                      {formatDate(memo.updatedAt)}
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleEditStart(memo)}
                        className="rounded-lg px-2.5 py-1 text-xs font-medium text-mentor-primary hover:bg-mentor-accent/50 transition-colors"
                      >
                        편집
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(memo.id)}
                        className="rounded-lg px-2.5 py-1 text-xs font-medium text-mentor-danger hover:bg-red-50 transition-colors"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
