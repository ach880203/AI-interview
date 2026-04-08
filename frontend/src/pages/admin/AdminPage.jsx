import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import * as adminApi from '../../api/admin';
import * as bookApi from '../../api/book';
import * as customerCenterApi from '../../api/customerCenter';
import Button from '../../components/ui/Button';
import { ORDER_STATUS_LABELS } from '../../data/orderStatusLabels';

const ADMIN_TABS = [
  { key: 'users', label: '회원관리' },
  { key: 'products', label: '상품관리' },
  { key: 'payments', label: '결제관리' },
  { key: 'shipping', label: '배송관리' },
  { key: 'inquiries', label: '문의관리' },
  { key: 'revenue', label: '매출관리' },
];

/** 파이 차트 색상 */
const PIE_COLORS = ['#6366f1', '#22c55e', '#ef4444'];

const INITIAL_BOOK_FORM = {
  title: '',
  author: '',
  publisher: '',
  price: '',
  stock: '',
  coverUrl: '',
  description: '',
};

const INITIAL_FAQ_FORM = {
  category: '',
  question: '',
  answer: '',
};

const INITIAL_DASHBOARD = {
  totalUsers: 0,
  totalBooks: 0,
  totalOrders: 0,
  pendingOrders: 0,
  lowStockBooks: 0,
  adminUsers: 0,
  totalSales: 0,
};

/**
 * 관리자 페이지입니다.
 *
 * [역할]
 * 회원, 상품, 결제, 배송, 문의를 탭 단위로 분리해 실제 운영 화면처럼 정리합니다.
 *
 * [중요]
 * 회원 정지/복구는 아직 화면 상태 기준으로 동작합니다.
 * 반면 상품 등록/수정/삭제, 배송 상태 변경, 환불 승인, 고객센터 문의 답변은 실제 API와 연결했습니다.
 */
export default function AdminPage() {
  const [activeTab, setActiveTab] = useState('users');
  const [dashboard, setDashboard] = useState(INITIAL_DASHBOARD);
  const [users, setUsers] = useState([]);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [roleDrafts, setRoleDrafts] = useState({});
  const [bookForm, setBookForm] = useState(INITIAL_BOOK_FORM);
  const [editingBookId, setEditingBookId] = useState(null);
  const [savingRoleUserId, setSavingRoleUserId] = useState(null);
  const [savingProduct, setSavingProduct] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [localImages, setLocalImages] = useState([]);
  const [savingShippingOrderId, setSavingShippingOrderId] = useState(null);
  const [savingRefundOrderId, setSavingRefundOrderId] = useState(null);
  const [shippingDrafts, setShippingDrafts] = useState({});
  const [faqs, setFaqs] = useState([]);
  const [faqForm, setFaqForm] = useState(INITIAL_FAQ_FORM);
  const [editingFaqId, setEditingFaqId] = useState(null);
  const [loadingFaqs, setLoadingFaqs] = useState(false);
  const [savingFaq, setSavingFaq] = useState(false);
  const [deletingFaqId, setDeletingFaqId] = useState(null);
  const [inquiries, setInquiries] = useState([]);
  const [inquiryReplyDrafts, setInquiryReplyDrafts] = useState({});
  const [loadingInquiries, setLoadingInquiries] = useState(false);
  const [savingInquiryId, setSavingInquiryId] = useState(null);
  const [makingPrivateInquiryId, setMakingPrivateInquiryId] = useState(null);

  /* ── 매출 통계 상태 ── */
  const [revenue, setRevenue] = useState(null);
  const [revenueCalendarDate, setRevenueCalendarDate] = useState(() => {
    const today = new Date();
    return today.toISOString().slice(0, 10);
  });
  const [revenueCalendarMode, setRevenueCalendarMode] = useState('day');
  const [revenueDateResult, setRevenueDateResult] = useState(null);
  const [loadingRevenueDate, setLoadingRevenueDate] = useState(false);

  /**
   * 관리자 화면의 데이터를 불러옵니다.
   */
  const fetchAdminData = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const [dashboardResult, usersResult, bookResult, orderResult, revenueResult] = await Promise.all([
        adminApi.getAdminDashboard(),
        adminApi.getAdminUsers(),
        bookApi.getBooks({ page: 0, size: 100 }),
        adminApi.getAdminOrders(),
        adminApi.getAdminRevenue().catch(() => ({ data: { data: null } })),
      ]);

      const nextUsers = (usersResult.data.data ?? []).map((user) => ({
        ...user,
        accountStatus: '정상',
      }));
      const nextProducts = bookResult.data.data?.content ?? [];
      const nextOrders = (orderResult.data.data ?? []).map((order) => ({
        ...order,
        paymentStatus:
          order.status === 'REFUNDED'
            ? '환불 완료'
            : order.status === 'REFUND_REQUESTED'
              ? '환불 요청'
              : order.status === 'CANCEL_REQUESTED'
                ? '취소 요청'
                : order.status === 'CANCELLED'
                  ? '취소됨'
                  : order.status === 'PAID'
                      || order.status === 'SHIPPED'
                      || order.status === 'DELIVERED'
                      || order.status === 'PURCHASE_CONFIRMED'
                    ? '결제 완료'
                    : '결제 대기',
        refundRequest: order.status === 'REFUND_REQUESTED',
        cancelRequest: order.status === 'CANCEL_REQUESTED',
        refundReason: order.lastActionReason ?? '',
      }));

      setDashboard(dashboardResult.data.data ?? INITIAL_DASHBOARD);
      setRevenue(revenueResult.data.data ?? null);
      setUsers(nextUsers);
      setProducts(nextProducts);
      setOrders(nextOrders);
      setRoleDrafts(
        nextUsers.reduce((accumulator, user) => {
          accumulator[user.id] = user.role;
          return accumulator;
        }, {})
      );
      setShippingDrafts(
        nextOrders.reduce((accumulator, order) => {
          accumulator[order.id] = order.status;
          return accumulator;
        }, {})
      );
    } catch (requestError) {
      setError(
        requestError.response?.data?.error?.message ??
          '관리자 데이터를 불러오지 못했습니다.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAdminData();
  }, [fetchAdminData]);

  // frontend/src/img/ 에 있는 이미지 파일 목록을 로드합니다.
  useEffect(() => {
    const modules = import.meta.glob('/src/img/*.{jpg,jpeg,png,gif,webp,svg}', { eager: true, query: '?url', import: 'default' });
    const entries = Object.entries(modules).map(([path, url]) => ({
      name: path.split('/').pop(),
      url,
    }));
    setLocalImages(entries);
  }, []);

  /**
   * 고객센터 FAQ 목록을 다시 불러옵니다.
   * 같은 탭에서 FAQ와 문의를 함께 관리하므로 최신 데이터를 별도 상태로 유지합니다.
   */
  const refreshFaqs = useCallback(async () => {
    setLoadingFaqs(true);

    try {
      const response = await customerCenterApi.getAdminCustomerCenterFaqs();
      setFaqs(response.data.data ?? []);
    } catch (requestError) {
      setError(
        requestError.response?.data?.error?.message ??
          '고객센터 FAQ 목록을 불러오지 못했습니다.'
      );
    } finally {
      setLoadingFaqs(false);
    }
  }, []);

  /**
   * 고객센터 문의 목록을 다시 읽습니다.
   * 문의 탭에 들어올 때마다 최신 답변 상태를 다시 불러오도록 API 호출을 분리했습니다.
   */
  const refreshInquiries = useCallback(async () => {
    setLoadingInquiries(true);

    try {
      const response = await customerCenterApi.getAdminCustomerCenterInquiries();
      const nextInquiries = response.data.data ?? [];

      setInquiries(nextInquiries);
      setInquiryReplyDrafts(
        nextInquiries.reduce((accumulator, inquiry) => {
          accumulator[inquiry.id] = inquiry.reply ?? '';
          return accumulator;
        }, {})
      );
    } catch (requestError) {
      setError(
        requestError.response?.data?.error?.message ??
          '고객센터 문의 목록을 불러오지 못했습니다.'
      );
    } finally {
      setLoadingInquiries(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'inquiries') {
      refreshFaqs();
      refreshInquiries();
    }
  }, [activeTab, refreshFaqs, refreshInquiries]);

  /**
   * 매출 통계를 불러옵니다.
   * 매출관리 탭 진입 시 자동 호출됩니다.
   */
  const refreshRevenue = useCallback(async () => {
    try {
      const response = await adminApi.getAdminRevenue();
      setRevenue(response.data.data ?? null);
    } catch (requestError) {
      setError(
        requestError.response?.data?.error?.message ??
          '매출 통계를 불러오지 못했습니다.'
      );
    } finally {
      /* 매출 탭은 기존 loading 상태로 충분히 구분되어 별도 로딩 상태를 두지 않습니다. */
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'revenue') {
      refreshRevenue();
    }
  }, [activeTab, refreshRevenue]);

  /**
   * 달력에서 선택한 날짜/월/연의 매출을 조회합니다.
   */
  async function handleSearchRevenueByDate() {
    setLoadingRevenueDate(true);
    setError('');
    try {
      const { startDate, endDate } = getDateRange(revenueCalendarDate, revenueCalendarMode);
      const response = await adminApi.getAdminRevenueByDate(startDate, endDate);
      setRevenueDateResult(response.data.data ?? null);
    } catch (requestError) {
      setError(
        requestError.response?.data?.error?.message ??
          '기간별 매출 조회에 실패했습니다.'
      );
    } finally {
      setLoadingRevenueDate(false);
    }
  }

  /**
   * 회원 권한을 저장합니다.
   */
  async function handleSaveRole(userId) {
    setSavingRoleUserId(userId);
    setError('');
    setSuccessMessage('');

    try {
      await adminApi.updateAdminUserRole(userId, { role: roleDrafts[userId] });
      setSuccessMessage('회원 권한을 변경했습니다.');
      await fetchAdminData();
    } catch (requestError) {
      setError(
        requestError.response?.data?.error?.message ??
          '회원 권한 변경에 실패했습니다.'
      );
    } finally {
      setSavingRoleUserId(null);
    }
  }

  /**
   * 회원 상태를 화면 기준으로 바꿉니다.
   */
  function handleToggleUserStatus(userId) {
    setUsers((previous) =>
      previous.map((user) =>
        user.id === userId
          ? { ...user, accountStatus: user.accountStatus === '정상' ? '정지' : '정상' }
          : user
      )
    );
  }

  /**
   * 상품 편집 폼을 엽니다.
   */
  function handleEditProduct(product) {
    setEditingBookId(product.id);
    setBookForm({
      title: product.title ?? '',
      author: product.author ?? '',
      publisher: product.publisher ?? '',
      price: String(product.price ?? ''),
      stock: String(product.stock ?? ''),
      coverUrl: product.coverUrl ?? '',
      description: product.description ?? '',
    });
  }

  /**
   * 상품 폼을 초기화합니다.
   */
  function resetProductForm() {
    setEditingBookId(null);
    setBookForm(INITIAL_BOOK_FORM);
  }

  /**
   * 표지 이미지 파일 업로드 핸들러
   */
  async function handleCoverFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      setError('이미지 파일은 20MB를 초과할 수 없습니다.');
      e.target.value = '';
      return;
    }
    if (!file.type.startsWith('image/')) {
      setError('이미지 파일만 업로드할 수 있습니다.');
      e.target.value = '';
      return;
    }

    setUploadingCover(true);
    setError('');
    try {
      const res = await bookApi.uploadBookCover(file);
      const url = res.data.data.url;
      setBookForm((prev) => ({ ...prev, coverUrl: url }));
      setSuccessMessage('이미지가 업로드되었습니다.');
    } catch (err) {
      setError(err.response?.data?.error?.message ?? '이미지 업로드에 실패했습니다.');
    } finally {
      setUploadingCover(false);
      e.target.value = '';
    }
  }

  /**
   * 상품 등록 또는 수정을 저장합니다.
   */
  async function handleSaveProduct() {
    setSavingProduct(true);
    setError('');
    setSuccessMessage('');

    try {
      const payload = {
        title: bookForm.title.trim(),
        author: bookForm.author.trim(),
        publisher: bookForm.publisher.trim(),
        price: Number(bookForm.price),
        stock: Number(bookForm.stock),
        coverUrl: bookForm.coverUrl.trim(),
        description: bookForm.description.trim(),
      };

      if (editingBookId) {
        await bookApi.updateBook(editingBookId, payload);
        setSuccessMessage('상품을 수정했습니다.');
      } else {
        await bookApi.createBook(payload);
        setSuccessMessage('상품을 등록했습니다.');
      }

      resetProductForm();
      await fetchAdminData();
    } catch (requestError) {
      setError(
        requestError.response?.data?.error?.message ??
          '상품 저장에 실패했습니다.'
      );
    } finally {
      setSavingProduct(false);
    }
  }

  /**
   * 상품을 삭제합니다.
   */
  async function handleDeleteProduct(productId) {
    setError('');
    setSuccessMessage('');

    try {
      await bookApi.deleteBook(productId);
      setSuccessMessage('상품을 삭제했습니다.');
      await fetchAdminData();
    } catch (requestError) {
      setError(
        requestError.response?.data?.error?.message ??
          '상품 삭제에 실패했습니다.'
      );
    }
  }

  /**
   * 배송 상태를 저장합니다.
   */
  async function handleSaveShipping(orderId) {
    setSavingShippingOrderId(orderId);
    setError('');
    setSuccessMessage('');

    try {
      await adminApi.updateAdminOrderStatus(orderId, {
        status: shippingDrafts[orderId],
      });
      setSuccessMessage('배송 상태를 변경했습니다.');
      await fetchAdminData();
    } catch (requestError) {
      setError(
        requestError.response?.data?.error?.message ??
          '배송 상태 변경에 실패했습니다.'
      );
    } finally {
      setSavingShippingOrderId(null);
    }
  }

  /**
   * 환불 승인을 실제 API에 반영합니다.
   */
  async function handleApproveRefund(orderId) {
    setSavingRefundOrderId(orderId);
    setError('');
    setSuccessMessage('');

    try {
      await adminApi.updateAdminOrderStatus(orderId, {
        status: 'REFUNDED',
        reason: orders.find((order) => order.id === orderId)?.refundReason ?? '',
      });
      setSuccessMessage('환불 요청을 승인했습니다.');
      await fetchAdminData();
    } catch (requestError) {
      setError(
        requestError.response?.data?.error?.message ??
          '환불 승인에 실패했습니다.'
      );
    } finally {
      setSavingRefundOrderId(null);
    }
  }

  /**
   * 취소 요청 승인을 실제 API에 반영합니다.
   */
  async function handleApproveCancelRequest(orderId) {
    setSavingRefundOrderId(orderId);
    setError('');
    setSuccessMessage('');

    try {
      await adminApi.updateAdminOrderStatus(orderId, {
        status: 'CANCELLED',
        reason: orders.find((order) => order.id === orderId)?.refundReason ?? '관리자 취소 승인',
      });
      setSuccessMessage('취소 요청을 승인했습니다.');
      await fetchAdminData();
    } catch (requestError) {
      setError(
        requestError.response?.data?.error?.message ??
          '취소 승인에 실패했습니다.'
      );
    } finally {
      setSavingRefundOrderId(null);
    }
  }

  /**
   * 답변 초안을 로컬 상태에만 반영합니다.
   * 입력할 때마다 서버를 호출하면 과도한 저장 요청이 생기므로 저장 버튼과 분리합니다.
   */
  function handleInquiryReplyDraftChange(inquiryId, reply) {
    setInquiryReplyDrafts((previousDrafts) => ({
      ...previousDrafts,
      [inquiryId]: reply,
    }));
  }

  /**
   * 문의 답변을 실제 API에 저장합니다.
   * 답변 내용을 비워 둔 채 저장하면 사용자가 왜 실패했는지 이해하기 어려우므로 프런트에서도 한 번 더 막습니다.
   */
  async function handleSaveInquiryReply(inquiryId) {
    const replyDraft = inquiryReplyDrafts[inquiryId]?.trim() ?? '';

    if (!replyDraft) {
      setError('답변 내용을 입력해주세요.');
      setSuccessMessage('');
      return;
    }

    setSavingInquiryId(inquiryId);
    setError('');
    setSuccessMessage('');

    try {
      await customerCenterApi.replyAdminCustomerCenterInquiry(inquiryId, {
        reply: replyDraft,
      });
      setSuccessMessage('문의 답변을 저장했습니다.');
      await refreshInquiries();
    } catch (requestError) {
      setError(
        requestError.response?.data?.error?.message ??
          '문의 답변 저장에 실패했습니다.'
      );
    } finally {
      setSavingInquiryId(null);
    }
  }

  /**
   * 공개 문의를 비밀글로 전환합니다.
   *
   * [운영 의도]
   * 한 번 비밀글로 내린 문의는 일반 사용자가 다시 공개로 바꾸지 못하게
   * 관리자 화면에서만 단방향 전환 버튼을 제공합니다.
   */
  async function handleMakeInquiryPrivate(inquiryId) {
    const confirmed = window.confirm('이 공개 문의를 비밀글로 전환하시겠습니까? 일반 사용자는 다시 공개로 바꿀 수 없습니다.');
    if (!confirmed) return;

    setMakingPrivateInquiryId(inquiryId);

    try {
      await customerCenterApi.makeAdminCustomerCenterInquiryPrivate(inquiryId);
      setSuccessMessage('공개 문의를 비밀글로 전환했습니다.');
      await refreshInquiries();
    } catch (requestError) {
      setError(
        requestError.response?.data?.error?.message ??
          '공개 문의를 비밀글로 전환하지 못했습니다.'
      );
    } finally {
      setMakingPrivateInquiryId(null);
    }
  }

  /**
   * FAQ 수정 모드로 전환합니다.
   * 기존 항목을 그대로 불러와야 초보자도 어떤 값을 고치는지 바로 이해할 수 있습니다.
   */
  function handleEditFaq(faq) {
    setEditingFaqId(faq.id);
    setFaqForm({
      category: faq.category ?? '',
      question: faq.question ?? '',
      answer: faq.answer ?? '',
    });
  }

  /**
   * FAQ 입력 폼을 초기 상태로 되돌립니다.
   */
  function resetFaqForm() {
    setEditingFaqId(null);
    setFaqForm(INITIAL_FAQ_FORM);
  }

  /**
   * FAQ를 등록하거나 수정합니다.
   * 같은 입력 폼을 재사용해도 등록/수정 흐름이 섞이지 않도록 editingFaqId로 분기합니다.
   */
  async function handleSaveFaq() {
    const category = faqForm.category.trim();
    const question = faqForm.question.trim();
    const answer = faqForm.answer.trim();

    if (!category || !question || !answer) {
      setError('FAQ 분류, 질문, 답변을 모두 입력해주세요.');
      setSuccessMessage('');
      return;
    }

    setSavingFaq(true);
    setError('');
    setSuccessMessage('');

    try {
      const payload = { category, question, answer };

      if (editingFaqId) {
        await customerCenterApi.updateAdminCustomerCenterFaq(editingFaqId, payload);
        setSuccessMessage('FAQ를 수정했습니다.');
      } else {
        await customerCenterApi.createAdminCustomerCenterFaq(payload);
        setSuccessMessage('FAQ를 등록했습니다.');
      }

      resetFaqForm();
      await refreshFaqs();
    } catch (requestError) {
      setError(
        requestError.response?.data?.error?.message ??
          'FAQ 저장에 실패했습니다.'
      );
    } finally {
      setSavingFaq(false);
    }
  }

  /**
   * FAQ를 삭제합니다.
   * 삭제 중인 항목 ID를 따로 들고 있어야 버튼 로딩 상태가 다른 카드에 번지지 않습니다.
   */
  async function handleDeleteFaq(faqId) {
    setDeletingFaqId(faqId);
    setError('');
    setSuccessMessage('');

    try {
      await customerCenterApi.deleteAdminCustomerCenterFaq(faqId);

      if (editingFaqId === faqId) {
        resetFaqForm();
      }

      setSuccessMessage('FAQ를 삭제했습니다.');
      await refreshFaqs();
    } catch (requestError) {
      setError(
        requestError.response?.data?.error?.message ??
          'FAQ 삭제에 실패했습니다.'
      );
    } finally {
      setDeletingFaqId(null);
    }
  }

  const paymentRows = useMemo(() => {
    return orders.filter(
      (order) => order.paymentStatus || order.refundRequest || order.cancelRequest
    );
  }, [orders]);

  return (
    <div className="min-h-screen bg-mentor-bg px-4 py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-[32px] bg-mentor-surface p-7 shadow-sm">
          <p className="text-sm font-semibold text-mentor-primary">관리자 페이지</p>
          <h1 className="mt-3 text-3xl font-bold text-mentor-text">운영 작업을 탭별로 나눠 정리했습니다.</h1>
          <p className="mt-3 text-sm leading-6 text-mentor-muted">
            한 화면에 다 넣지 않고 회원, 상품, 결제, 배송, 문의 흐름을 분리해 실제 운영 도구처럼 이해하기 쉽게 만들었습니다.
          </p>
        </section>

        {error && (
          <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
        )}
        {successMessage && (
          <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-600">
            {successMessage}
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="전체 회원" value={loading ? '-' : dashboard.totalUsers} />
          <SummaryCard label="전체 상품" value={loading ? '-' : dashboard.totalBooks} />
          <SummaryCard label="진행 주문" value={loading ? '-' : dashboard.pendingOrders} />
          <SummaryCard
            label="총 매출"
            value={loading ? '-' : `${dashboard.totalSales.toLocaleString('ko-KR')}원`}
          />
        </section>

        {/* ── 매출 요약 위젯 ── */}
        {revenue && (
          <section className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
              <SummaryCard label="구독 매출" value={`${revenue.subscriptionSales.toLocaleString('ko-KR')}원`} />
              <SummaryCard label="도서 매출" value={`${revenue.bookSales.toLocaleString('ko-KR')}원`} />
              <SummaryCard label="환불/취소" value={`${revenue.refundTotal.toLocaleString('ko-KR')}원`} />
              <SummaryCard label="일 매출" value={`${revenue.dailySales.toLocaleString('ko-KR')}원`} />
              <SummaryCard label="월 매출" value={`${revenue.monthlySales.toLocaleString('ko-KR')}원`} />
              <SummaryCard label="연 매출" value={`${revenue.yearlySales.toLocaleString('ko-KR')}원`} />
            </div>

            {/* 매출 구성 차트 */}
            <div className="grid gap-4 md:grid-cols-2">
              <article className="rounded-[28px] bg-mentor-surface p-6 shadow-sm">
                <p className="mb-4 text-sm font-semibold text-mentor-muted">매출 구성 (구독 / 도서 / 환불)</p>
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: '구독 매출', value: revenue.subscriptionSales },
                        { name: '도서 매출', value: revenue.bookSales },
                        { name: '환불/취소', value: revenue.refundTotal },
                      ]}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={90}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {PIE_COLORS.map((color, index) => (
                        <Cell key={index} fill={color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `${value.toLocaleString('ko-KR')}원`} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </article>

              <article className="rounded-[28px] bg-mentor-surface p-6 shadow-sm">
                <p className="mb-4 text-sm font-semibold text-mentor-muted">기간별 매출 비교</p>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart
                    data={[
                      { name: '일 매출', value: revenue.dailySales },
                      { name: '월 매출', value: revenue.monthlySales },
                      { name: '연 매출', value: revenue.yearlySales },
                    ]}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={(value) => `${(value / 10000).toFixed(0)}만`} />
                    <Tooltip formatter={(value) => `${value.toLocaleString('ko-KR')}원`} />
                    <Bar dataKey="value" fill="#6366f1" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </article>
            </div>
          </section>
        )}

        <section className="rounded-[32px] bg-mentor-surface p-4 shadow-sm">
          <div className="flex flex-wrap gap-2">
            {ADMIN_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  activeTab === tab.key
                    ? 'bg-mentor-primary text-white'
                    : 'bg-mentor-bg text-mentor-muted hover:bg-mentor-border'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </section>

        {activeTab === 'users' && (
          <section className="rounded-[32px] bg-mentor-surface p-6 shadow-sm">
            <div className="mb-5">
              <h2 className="text-xl font-bold text-mentor-text">회원관리</h2>
              <p className="mt-1 text-sm text-mentor-muted">
                복잡한 표 대신 필요한 정보만 남겨 간단하게 관리할 수 있도록 구성했습니다.
              </p>
            </div>
            <div className="space-y-3">
              {users.map((user) => (
                <article key={user.id} className="rounded-2xl border border-mentor-border px-4 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-mentor-text">{user.name}</p>
                      <p className="mt-1 text-xs text-mentor-muted">{user.email}</p>
                      <p className="mt-1 text-xs text-mentor-muted">
                        상태: {user.accountStatus}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={roleDrafts[user.id] ?? user.role}
                        onChange={(event) =>
                          setRoleDrafts((previous) => ({
                            ...previous,
                            [user.id]: event.target.value,
                          }))
                        }
                        className="rounded-2xl border border-mentor-border px-3 py-2 text-sm outline-none transition focus:border-mentor-primary focus:ring-2 focus:ring-mentor-accent"
                      >
                        <option value="USER">USER</option>
                        <option value="ADMIN">ADMIN</option>
                      </select>
                      <Button
                        className="w-auto px-4"
                        loading={savingRoleUserId === user.id}
                        onClick={() => handleSaveRole(user.id)}
                      >
                        권한 저장
                      </Button>
                      <Button
                        className="w-auto px-4"
                        variant={user.accountStatus === '정상' ? 'danger' : 'secondary'}
                        onClick={() => handleToggleUserStatus(user.id)}
                      >
                        {user.accountStatus === '정상' ? '회원 정지' : '복구'}
                      </Button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {activeTab === 'products' && (
          <section className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
            <div className="rounded-[32px] bg-mentor-surface p-6 shadow-sm">
              <h2 className="text-xl font-bold text-mentor-text">상품 등록 / 수정</h2>
              <p className="mt-1 text-sm text-mentor-muted">
                상품관리 탭에서 도서 등록, 수정, 삭제를 처리할 수 있게 실제 API와 연결했습니다.
              </p>

              <div className="mt-5 space-y-3">
                <Field label="도서명" value={bookForm.title} onChange={(value) => setBookForm({ ...bookForm, title: value })} />
                <Field label="저자" value={bookForm.author} onChange={(value) => setBookForm({ ...bookForm, author: value })} />
                <Field label="출판사" value={bookForm.publisher} onChange={(value) => setBookForm({ ...bookForm, publisher: value })} />
                <Field label="가격" type="number" value={bookForm.price} onChange={(value) => setBookForm({ ...bookForm, price: value })} />
                <Field label="재고" type="number" value={bookForm.stock} onChange={(value) => setBookForm({ ...bookForm, stock: value })} />
                <Field label="표지 URL" value={bookForm.coverUrl} onChange={(value) => setBookForm({ ...bookForm, coverUrl: value })} />

                {/* 이미지 파일 업로드 */}
                <div>
                  <label className="mb-1 block text-xs font-semibold text-mentor-muted">표지 이미지 업로드</label>
                  <div className="flex items-center gap-2">
                    <label className={`cursor-pointer rounded-xl border border-mentor-border px-3 py-2 text-xs font-semibold transition hover:bg-mentor-accent ${uploadingCover ? 'opacity-50 pointer-events-none' : 'text-mentor-primary'}`}>
                      {uploadingCover ? '업로드 중...' : '파일 선택 (최대 20MB)'}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleCoverFileChange}
                        disabled={uploadingCover}
                      />
                    </label>
                    {localImages.length > 0 && (
                      <select
                        className="rounded-xl border border-mentor-border bg-mentor-bg/50 px-3 py-2 text-xs text-mentor-text focus:border-mentor-primary focus:outline-none"
                        value=""
                        onChange={(e) => {
                          if (e.target.value) setBookForm((prev) => ({ ...prev, coverUrl: e.target.value }));
                        }}
                      >
                        <option value="">src/img 이미지 선택</option>
                        {localImages.map((img) => (
                          <option key={img.name} value={img.url}>{img.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                {/* 미리보기 */}
                {bookForm.coverUrl && (
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-mentor-muted">미리보기</label>
                    <img
                      src={bookForm.coverUrl}
                      alt="표지 미리보기"
                      className="h-32 w-auto rounded-xl border border-mentor-border object-contain"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  </div>
                )}

                <TextAreaField label="설명" value={bookForm.description} onChange={(value) => setBookForm({ ...bookForm, description: value })} />
              </div>

              <div className="mt-5 flex gap-2">
                <Button loading={savingProduct} onClick={handleSaveProduct}>
                  {editingBookId ? '상품 수정' : '상품 등록'}
                </Button>
                <Button variant="secondary" onClick={resetProductForm}>
                  입력 초기화
                </Button>
              </div>
            </div>

            <div className="rounded-[32px] bg-mentor-surface p-6 shadow-sm">
              <h2 className="text-xl font-bold text-mentor-text">상품 목록</h2>
              <div className="mt-5 space-y-3">
                {products.map((product) => (
                  <article key={product.id} className="rounded-2xl border border-mentor-border px-4 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-mentor-text">{product.title}</p>
                        <p className="mt-1 text-xs text-mentor-muted">{product.author}</p>
                        <p className="mt-1 text-xs text-mentor-muted">
                          {product.price.toLocaleString('ko-KR')}원 · 재고 {product.stock}권
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button className="w-auto px-4" variant="secondary" onClick={() => handleEditProduct(product)}>
                          수정
                        </Button>
                        <Button className="w-auto px-4" variant="danger" onClick={() => handleDeleteProduct(product.id)}>
                          삭제
                        </Button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>
        )}

        {activeTab === 'payments' && (
          <section className="rounded-[32px] bg-mentor-surface p-6 shadow-sm">
            <h2 className="text-xl font-bold text-mentor-text">결제관리</h2>
            <p className="mt-1 text-sm text-mentor-muted">
              누가 언제 얼마를 결제했는지 확인하고, 환불 요청이 들어오면 승인 흐름을 처리합니다.
            </p>
            <div className="mt-5 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-mentor-border text-mentor-muted">
                    <th className="px-3 py-3 font-medium">주문번호</th>
                    <th className="px-3 py-3 font-medium">회원</th>
                    <th className="px-3 py-3 font-medium">상품</th>
                    <th className="px-3 py-3 font-medium">결제 상태</th>
                    <th className="px-3 py-3 font-medium">금액</th>
                    <th className="px-3 py-3 font-medium">환불 사유</th>
                    <th className="px-3 py-3 font-medium">처리</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentRows.map((order) => (
                    <tr key={order.id} className="border-b border-mentor-border">
                      <td className="px-3 py-3 font-semibold text-mentor-text">#{order.id}</td>
                      <td className="px-3 py-3">{order.userName}</td>
                      <td className="px-3 py-3 text-xs text-mentor-muted">{order.itemSummary ?? '-'}</td>
                      <td className="px-3 py-3">{order.paymentStatus}</td>
                      <td className="px-3 py-3">{order.totalPrice.toLocaleString('ko-KR')}원</td>
                      {/* 유저가 제출한 취소/환불 사유를 읽기 전용으로 표시합니다 */}
                      <td className="px-3 py-3">
                        <span className="text-sm text-mentor-text">
                          {order.refundReason || '-'}
                        </span>
                      </td>
                      <td className="px-3 py-3 space-x-2">
                        {order.cancelRequest && (
                          <Button
                            className="w-auto px-4"
                            variant="danger"
                            loading={savingRefundOrderId === order.id}
                            onClick={() => handleApproveCancelRequest(order.id)}
                          >
                            취소 승인
                          </Button>
                        )}
                        {order.refundRequest && (
                          <Button
                            className="w-auto px-4"
                            variant="secondary"
                            loading={savingRefundOrderId === order.id}
                            onClick={() => handleApproveRefund(order.id)}
                          >
                            환불 승인
                          </Button>
                        )}
                        {!order.cancelRequest && !order.refundRequest && (
                          <span className="text-sm text-mentor-muted">처리 완료</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {activeTab === 'shipping' && (
          <section className="rounded-[32px] bg-mentor-surface p-6 shadow-sm">
            <h2 className="text-xl font-bold text-mentor-text">배송관리</h2>
            <p className="mt-1 text-sm text-mentor-muted">
              주문 상품의 배송 상태를 조정하는 전용 화면입니다.
            </p>
            <div className="mt-5 space-y-3">
              {orders.map((order) => (
                <article key={order.id} className="rounded-2xl border border-mentor-border px-4 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-mentor-text">주문 #{order.id}</p>
                      {order.itemSummary && (
                        <p className="mt-0.5 text-xs font-medium text-mentor-primary">
                          {order.itemSummary}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-mentor-muted">
                        {order.userName} · {order.address}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={shippingDrafts[order.id] ?? order.status}
                        onChange={(event) =>
                          setShippingDrafts((previous) => ({
                            ...previous,
                            [order.id]: event.target.value,
                          }))
                        }
                        className="rounded-2xl border border-mentor-border px-3 py-2 text-sm outline-none transition focus:border-mentor-primary focus:ring-2 focus:ring-mentor-accent"
                      >
                        {getAllowedShippingStatuses(order.status).map((status) => (
                          <option key={status} value={status}>
                            {ORDER_STATUS_LABELS[status] ?? status}
                          </option>
                        ))}
                      </select>
                      <Button
                        className="w-auto px-4"
                        loading={savingShippingOrderId === order.id}
                        onClick={() => handleSaveShipping(order.id)}
                      >
                        상태 저장
                      </Button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {activeTab === 'inquiries' && (
          <div className="space-y-6">
            <section className="rounded-[32px] bg-mentor-surface p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-mentor-text">FAQ 관리</h2>
                  <p className="mt-1 text-sm text-mentor-muted">
                    고객센터에서 보여줄 FAQ를 같은 탭에서 바로 등록, 수정, 삭제합니다.
                  </p>
                </div>
                <Button className="w-auto px-4" variant="secondary" onClick={resetFaqForm}>
                  입력 초기화
                </Button>
              </div>

              <div className="mt-6 grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
                <div className="rounded-3xl bg-mentor-bg p-5">
                  <div className="space-y-4">
                    <Field
                      label="FAQ 분류"
                      value={faqForm.category}
                      onChange={(value) =>
                        setFaqForm((previousFaqForm) => ({
                          ...previousFaqForm,
                          category: value,
                        }))
                      }
                    />
                    <Field
                      label="FAQ 질문"
                      value={faqForm.question}
                      onChange={(value) =>
                        setFaqForm((previousFaqForm) => ({
                          ...previousFaqForm,
                          question: value,
                        }))
                      }
                    />
                    <TextAreaField
                      label="FAQ 답변"
                      value={faqForm.answer}
                      onChange={(value) =>
                        setFaqForm((previousFaqForm) => ({
                          ...previousFaqForm,
                          answer: value,
                        }))
                      }
                    />
                  </div>

                  <div className="mt-4 flex gap-2">
                    <Button loading={savingFaq} onClick={handleSaveFaq}>
                      {editingFaqId ? 'FAQ 수정' : 'FAQ 등록'}
                    </Button>
                    <Button className="w-auto px-4" variant="secondary" onClick={refreshFaqs}>
                      목록 새로고침
                    </Button>
                  </div>
                </div>

                <div className="space-y-4">
                  {loadingFaqs ? (
                    <div className="rounded-2xl border border-dashed border-mentor-border px-6 py-14 text-center">
                      <p className="text-sm text-mentor-muted">FAQ 목록을 불러오고 있습니다.</p>
                    </div>
                  ) : faqs.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-mentor-border px-6 py-14 text-center">
                      <p className="text-sm text-mentor-muted">등록된 FAQ가 아직 없습니다.</p>
                    </div>
                  ) : (
                    faqs.map((faq) => (
                      <article key={faq.id} className="rounded-2xl border border-mentor-border p-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-mentor-primary">
                              {faq.category}
                            </p>
                            <p className="mt-2 text-sm font-semibold text-mentor-text">
                              {faq.question}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              className="w-auto px-4"
                              variant="secondary"
                              onClick={() => handleEditFaq(faq)}
                            >
                              수정
                            </Button>
                            <Button
                              className="w-auto px-4"
                              variant="danger"
                              loading={deletingFaqId === faq.id}
                              onClick={() => handleDeleteFaq(faq.id)}
                            >
                              삭제
                            </Button>
                          </div>
                        </div>
                        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-mentor-muted">
                          {faq.answer}
                        </p>
                      </article>
                    ))
                  )}
                </div>
              </div>
            </section>

            <section className="rounded-[32px] bg-mentor-surface p-6 shadow-sm">
            <h2 className="text-xl font-bold text-mentor-text">고객센터 문의 관리</h2>
            <p className="mt-1 text-sm text-mentor-muted">
              고객센터에서 등록된 문의를 한곳에 모으고, 관리자 답변을 실제 문의 데이터에 저장하도록 연결했습니다.
            </p>
            {loadingInquiries ? (
              <div className="mt-5 rounded-2xl border border-dashed border-mentor-border px-6 py-14 text-center">
                <p className="text-sm text-mentor-muted">고객센터 문의를 불러오고 있습니다.</p>
              </div>
            ) : inquiries.length === 0 ? (
              <div className="mt-5 rounded-2xl border border-dashed border-mentor-border px-6 py-14 text-center">
                <p className="text-sm text-mentor-muted">등록된 고객센터 문의가 아직 없습니다.</p>
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                {inquiries.map((inquiry) => (
                  <article key={inquiry.id} className="rounded-2xl border border-mentor-border p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-mentor-text">{inquiry.title}</p>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              inquiry.isPublic
                                ? 'bg-blue-50 text-blue-600'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {inquiry.isPublic ? '공개글' : '비밀글'}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-mentor-muted">
                          {inquiry.userName} · {inquiry.userEmail ?? '이메일 없음'}
                        </p>
                      </div>
                      <span className="rounded-full bg-mentor-bg px-3 py-1 text-xs font-semibold text-mentor-muted">
                        {inquiry.status}
                      </span>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-mentor-muted">
                      {inquiry.content}
                    </p>
                    <TextAreaField
                      label="답변"
                      value={inquiryReplyDrafts[inquiry.id] ?? ''}
                      onChange={(value) => handleInquiryReplyDraftChange(inquiry.id, value)}
                    />
                    <div className="mt-3 flex justify-end">
                      {inquiry.isPublic && (
                        <button
                          type="button"
                          onClick={() => handleMakeInquiryPrivate(inquiry.id)}
                          disabled={makingPrivateInquiryId === inquiry.id}
                          className="mr-2 rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                        >
                          {makingPrivateInquiryId === inquiry.id ? '변경 중...' : '비밀글로 전환'}
                        </button>
                      )}
                      <Button
                        className="w-auto px-4"
                        loading={savingInquiryId === inquiry.id}
                        onClick={() => handleSaveInquiryReply(inquiry.id)}
                      >
                        답변 저장
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
          </div>
        )}

        {/* ── 매출관리 탭 ── */}
        {activeTab === 'revenue' && (
          <section className="rounded-[32px] bg-mentor-surface p-6 shadow-sm">
            <h2 className="text-xl font-bold text-mentor-text">매출관리</h2>
            <p className="mt-1 text-sm text-mentor-muted">
              달력에서 날짜를 선택하고 년/월/일 단위로 매출 현황을 확인합니다.
            </p>

            <div className="mt-5 grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
              {/* 날짜 선택 영역 */}
              <div className="rounded-3xl bg-mentor-bg p-5 space-y-4">
                <div className="flex gap-2">
                  {['day', 'month', 'year'].map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setRevenueCalendarMode(mode)}
                      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                        revenueCalendarMode === mode
                          ? 'bg-mentor-primary text-white'
                          : 'bg-mentor-surface text-mentor-muted hover:bg-mentor-border'
                      }`}
                    >
                      {mode === 'day' ? '일별' : mode === 'month' ? '월별' : '연별'}
                    </button>
                  ))}
                </div>

                <input
                  type={revenueCalendarMode === 'year' ? 'number' : revenueCalendarMode === 'month' ? 'month' : 'date'}
                  value={
                    revenueCalendarMode === 'year'
                      ? revenueCalendarDate.slice(0, 4)
                      : revenueCalendarMode === 'month'
                        ? revenueCalendarDate.slice(0, 7)
                        : revenueCalendarDate
                  }
                  onChange={(event) => {
                    const value = event.target.value;
                    if (revenueCalendarMode === 'year') {
                      setRevenueCalendarDate(`${value}-01-01`);
                    } else if (revenueCalendarMode === 'month') {
                      setRevenueCalendarDate(`${value}-01`);
                    } else {
                      setRevenueCalendarDate(value);
                    }
                  }}
                  className="w-full rounded-2xl border border-mentor-border px-4 py-3 text-sm outline-none transition focus:border-mentor-primary focus:ring-2 focus:ring-mentor-accent"
                />

                <Button loading={loadingRevenueDate} onClick={handleSearchRevenueByDate}>
                  매출 조회
                </Button>
              </div>

              {/* 조회 결과 영역 */}
              <div className="space-y-4">
                {revenueDateResult ? (
                  <>
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                      <SummaryCard label="구독 매출" value={`${revenueDateResult.subscriptionSales.toLocaleString('ko-KR')}원`} />
                      <SummaryCard label="도서 매출" value={`${revenueDateResult.bookSales.toLocaleString('ko-KR')}원`} />
                      <SummaryCard label="환불/취소" value={`${revenueDateResult.refundTotal.toLocaleString('ko-KR')}원`} />
                      <SummaryCard label="총 매출" value={`${revenueDateResult.totalSales.toLocaleString('ko-KR')}원`} />
                    </div>

                    <article className="rounded-[28px] bg-mentor-bg p-6">
                      <p className="mb-3 text-sm font-semibold text-mentor-muted">
                        {revenueDateResult.startDate} ~ {revenueDateResult.endDate} 매출 구성
                      </p>
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart
                          data={[
                            { name: '구독', value: revenueDateResult.subscriptionSales },
                            { name: '도서', value: revenueDateResult.bookSales },
                            { name: '환불', value: revenueDateResult.refundTotal },
                          ]}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis tickFormatter={(v) => `${(v / 10000).toFixed(0)}만`} />
                          <Tooltip formatter={(v) => `${v.toLocaleString('ko-KR')}원`} />
                          <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                            {PIE_COLORS.map((color, i) => (
                              <Cell key={i} fill={color} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </article>
                  </>
                ) : (
                  <div className="rounded-2xl border border-dashed border-mentor-border px-6 py-14 text-center">
                    <p className="text-sm text-mentor-muted">
                      {loadingRevenueDate ? '매출을 조회하고 있습니다...' : '날짜를 선택하고 조회 버튼을 눌러주세요.'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

/**
 * 날짜 모드에 따라 시작/종료 날짜를 계산합니다.
 *
 * @param {string} dateStr yyyy-MM-dd 형식 날짜
 * @param {'day' | 'month' | 'year'} mode 조회 단위
 * @returns {{ startDate: string, endDate: string }}
 */
function getDateRange(dateStr, mode) {
  const date = new Date(dateStr);
  if (mode === 'year') {
    const year = date.getFullYear();
    return { startDate: `${year}-01-01`, endDate: `${year}-12-31` };
  }
  if (mode === 'month') {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const lastDay = new Date(year, date.getMonth() + 1, 0).getDate();
    return { startDate: `${year}-${month}-01`, endDate: `${year}-${month}-${lastDay}` };
  }
  const isoDate = dateStr;
  return { startDate: isoDate, endDate: isoDate };
}

/**
 * 관리자 요약 카드입니다.
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
 * 한 줄 입력 필드입니다.
 */
function Field({ label, value, onChange, type = 'text' }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-mentor-text">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-2xl border border-mentor-border px-4 py-3 text-sm outline-none transition focus:border-mentor-primary focus:ring-2 focus:ring-mentor-accent"
      />
    </label>
  );
}

/**
 * 여러 줄 입력 필드입니다.
 */
function TextAreaField({ label, value, onChange }) {
  return (
    <label className="mt-4 block">
      <span className="text-sm font-semibold text-mentor-text">{label}</span>
      <textarea
        rows={4}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-2xl border border-mentor-border px-4 py-3 text-sm outline-none transition focus:border-mentor-primary focus:ring-2 focus:ring-mentor-accent"
      />
    </label>
  );
}

/**
 * 배송 상태 선택 범위를 제한합니다.
 */
function getAllowedShippingStatuses(currentStatus) {
  if (currentStatus === 'PENDING') {
    return ['PENDING', 'PAID', 'CANCELLED'];
  }

  if (currentStatus === 'PAID') {
    return ['PAID', 'SHIPPED', 'CANCELLED'];
  }

  if (currentStatus === 'SHIPPED') {
    return ['SHIPPED', 'DELIVERED'];
  }

  if (currentStatus === 'CANCEL_REQUESTED') {
    return ['CANCEL_REQUESTED', 'CANCELLED', 'PAID'];
  }

  if (currentStatus === 'REFUND_REQUESTED') {
    return ['REFUND_REQUESTED', 'REFUNDED', 'DELIVERED'];
  }

  return [currentStatus];
}