import { useCallback, useEffect, useMemo, useState } from 'react';
import * as customerCenterApi from '../api/customerCenter';
import useAuthStore from '../store/authStore';

/**
 * 문의 상태 한글 라벨 매핑입니다.
 *
 * [이유]
 * 백엔드가 status 필드에 한글 라벨을 이미 제공하지만,
 * DB 인코딩 문제로 '?' 로 저장된 경우에도 화면에서 의미 있는 한글 상태명이
 * 표시되도록 statusCode(영문 enum 명)를 1차 fallback 키로 매핑합니다.
 */
const INQUIRY_STATUS_LABELS = {
  WAITING: '답변 대기',
  ANSWERED: '답변 완료',
};

const FAQ_PAGE_SIZE = 5;
const MY_INQUIRIES_PAGE_SIZE = 5;

/**
 * 문의 상태 한글 라벨을 반환합니다.
 *
 * [우선순위]
 * 1. 백엔드 status 필드 (정상 케이스: "답변 대기" / "답변 완료")
 * 2. statusCode 영문 enum 명 → 한글 매핑 (DB 인코딩 오류 fallback)
 * 3. statusCode 원본 (마지막 fallback)
 */
function resolveStatusLabel(inquiry) {
  const label = inquiry.status?.trim();
  if (label && label !== '?' && !label.includes('?')) return label;
  return INQUIRY_STATUS_LABELS[inquiry.statusCode] ?? inquiry.statusCode ?? '확인 중';
}

/**
 * 고객센터 페이지입니다.
 *
 * [역할]
 * FAQ, 공개 문의(도움됨 기능 포함), 문의 등록(공개/비밀 선택), 내 문의 내역을 한 화면에서 보여줍니다.
 */
export default function CustomerCenterPage() {
  const user = useAuthStore((state) => state.user);

  const [faqItems, setFaqItems] = useState([]);
  const [openedFaqId, setOpenedFaqId] = useState('');
  const [inquiries, setInquiries] = useState([]);
  const [faqPage, setFaqPage] = useState(0);
  const [myInquiryPage, setMyInquiryPage] = useState(0);
  const [newInquiry, setNewInquiry] = useState({ title: '', content: '', isPublic: false });
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoadingFaqs, setIsLoadingFaqs] = useState(true);
  const [isLoadingInquiries, setIsLoadingInquiries] = useState(true);
  const [isSubmittingInquiry, setIsSubmittingInquiry] = useState(false);
  const [deletingInquiryId, setDeletingInquiryId] = useState(null);

  // 공개 문의 페이징 상태
  const [publicInquiries, setPublicInquiries] = useState([]);
  const [publicPage, setPublicPage] = useState(0);
  const [publicTotalPages, setPublicTotalPages] = useState(0);
  const [isLoadingPublic, setIsLoadingPublic] = useState(true);

  // 도움됨 로딩 상태 (문의 ID → boolean)
  const [helpfulLoading, setHelpfulLoading] = useState({});

  const refreshFaqs = useCallback(async () => {
    setIsLoadingFaqs(true);
    try {
      const response = await customerCenterApi.getCustomerCenterFaqs();
      const nextFaqItems = response.data.data ?? [];
      setFaqItems(nextFaqItems);
      setFaqPage(0);
      setOpenedFaqId((prev) => prev || nextFaqItems[0]?.id || '');
    } catch (requestError) {
      setError(requestError.response?.data?.error?.message ?? 'FAQ 목록을 불러오지 못했습니다.');
    } finally {
      setIsLoadingFaqs(false);
    }
  }, []);

  const refreshInquiries = useCallback(async () => {
    if (!user?.email) {
      setInquiries([]);
      setIsLoadingInquiries(false);
      return;
    }
    setIsLoadingInquiries(true);
    try {
      const response = await customerCenterApi.getMyCustomerCenterInquiries();
      setInquiries(response.data.data ?? []);
      setMyInquiryPage(0);
    } catch (requestError) {
      setError(requestError.response?.data?.error?.message ?? '내 문의 내역을 불러오지 못했습니다.');
    } finally {
      setIsLoadingInquiries(false);
    }
  }, [user?.email]);

  const refreshPublicInquiries = useCallback(async (page = 0) => {
    setIsLoadingPublic(true);
    try {
      const response = await customerCenterApi.getPublicInquiries(page, 5);
      const pageData = response.data.data ?? {};
      setPublicInquiries(pageData.content ?? []);
      setPublicTotalPages(pageData.totalPages ?? 0);
      setPublicPage(page);
    } catch {
      // 공개 문의 로딩 실패는 조용히 무시
      setPublicInquiries([]);
    } finally {
      setIsLoadingPublic(false);
    }
  }, []);

  useEffect(() => { refreshFaqs(); }, [refreshFaqs]);
  useEffect(() => { refreshInquiries(); }, [refreshInquiries]);
  useEffect(() => { refreshPublicInquiries(0); }, [refreshPublicInquiries]);

  const answeredInquiryCount = useMemo(
    () => inquiries.filter((inquiry) => inquiry.answered).length,
    [inquiries]
  );

  const faqTotalPages = useMemo(
    () => Math.ceil(faqItems.length / FAQ_PAGE_SIZE),
    [faqItems.length]
  );

  const visibleFaqItems = useMemo(() => {
    const startIndex = faqPage * FAQ_PAGE_SIZE;
    return faqItems.slice(startIndex, startIndex + FAQ_PAGE_SIZE);
  }, [faqItems, faqPage]);

  const myInquiryTotalPages = useMemo(
    () => Math.ceil(inquiries.length / MY_INQUIRIES_PAGE_SIZE),
    [inquiries.length]
  );

  const visibleInquiries = useMemo(() => {
    const startIndex = myInquiryPage * MY_INQUIRIES_PAGE_SIZE;
    return inquiries.slice(startIndex, startIndex + MY_INQUIRIES_PAGE_SIZE);
  }, [inquiries, myInquiryPage]);

  useEffect(() => {
    if (faqTotalPages === 0 && faqPage !== 0) {
      setFaqPage(0);
      return;
    }

    if (faqPage > 0 && faqPage >= faqTotalPages) {
      setFaqPage(faqTotalPages - 1);
    }
  }, [faqPage, faqTotalPages]);

  useEffect(() => {
    if (myInquiryTotalPages === 0 && myInquiryPage !== 0) {
      setMyInquiryPage(0);
      return;
    }

    if (myInquiryPage > 0 && myInquiryPage >= myInquiryTotalPages) {
      setMyInquiryPage(myInquiryTotalPages - 1);
    }
  }, [myInquiryPage, myInquiryTotalPages]);

  async function handleCreateInquiry() {
    if (!newInquiry.title.trim() || !newInquiry.content.trim()) {
      setError('문의 제목과 내용을 모두 입력해주세요.');
      setSuccessMessage('');
      return;
    }

    setIsSubmittingInquiry(true);
    setError('');
    setSuccessMessage('');

    try {
      await customerCenterApi.createCustomerCenterInquiry({
        title: newInquiry.title.trim(),
        content: newInquiry.content.trim(),
        isPublic: newInquiry.isPublic,
      });

      setNewInquiry({ title: '', content: '', isPublic: false });
      setSuccessMessage('문의가 등록되었습니다. 관리자 답변 상태는 아래 내 문의 내역에서 확인할 수 있습니다.');
      await refreshInquiries();
      if (newInquiry.isPublic) {
        await refreshPublicInquiries(0);
      }
    } catch (requestError) {
      setError(requestError.response?.data?.error?.message ?? '문의 등록에 실패했습니다.');
    } finally {
      setIsSubmittingInquiry(false);
    }
  }

  async function handleHelpful(inquiryId) {
    setHelpfulLoading((prev) => ({ ...prev, [inquiryId]: true }));
    try {
      await customerCenterApi.incrementInquiryHelpful(inquiryId);
      await refreshPublicInquiries(publicPage);
      await refreshFaqs();
    } catch {
      // 실패 시 조용히 무시
    } finally {
      setHelpfulLoading((prev) => ({ ...prev, [inquiryId]: false }));
    }
  }

  async function handleDeleteInquiry(inquiryId, isPublic) {
    const confirmed = window.confirm('이 문의를 삭제하시겠습니까? 삭제 후에는 되돌릴 수 없습니다.');
    if (!confirmed) return;

    setDeletingInquiryId(inquiryId);
    setError('');
    setSuccessMessage('');

    try {
      await customerCenterApi.deleteMyCustomerCenterInquiry(inquiryId);
      setSuccessMessage('문의가 삭제되었습니다.');
      await refreshInquiries();
      if (isPublic) {
        await refreshPublicInquiries(0);
      }
    } catch (requestError) {
      setError(requestError.response?.data?.error?.message ?? '문의 삭제에 실패했습니다.');
    } finally {
      setDeletingInquiryId(null);
    }
  }

  return (
    <div className="min-h-screen bg-mentor-bg px-4 py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* 헤더 */}
        <section className="rounded-[28px] bg-mentor-surface p-7 shadow-[var(--shadow-card)]">
          <p className="text-sm font-semibold text-mentor-primary">고객센터</p>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-mentor-text">FAQ와 문의를 한곳에서 관리합니다.</h1>
              <p className="mt-2 text-sm leading-6 text-mentor-muted">
                자주 묻는 질문을 먼저 확인하시고, 해결되지 않으면 문의를 남겨주세요.
              </p>
            </div>
            <div className="rounded-2xl bg-mentor-accent px-4 py-3 text-right">
              <p className="text-xs font-semibold text-mentor-primary">내 문의 현황</p>
              <p className="mt-1 text-sm font-semibold text-mentor-text">
                답변 완료 {answeredInquiryCount}건 / 전체 {inquiries.length}건
              </p>
            </div>
          </div>
        </section>

        {error && (
          <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
        )}
        {successMessage && (
          <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-600">{successMessage}</div>
        )}

        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          {/* 좌측: FAQ + 공개 문의 */}
          <div className="space-y-6">
            {/* FAQ 섹션 */}
            <section className="rounded-3xl bg-mentor-surface p-6 shadow-[var(--shadow-card)]">
              <h2 className="text-xl font-bold text-mentor-text">자주 묻는 질문</h2>

              <div className="mt-6 space-y-3">
                {isLoadingFaqs ? (
                  <div className="rounded-2xl border border-dashed border-mentor-border px-6 py-14 text-center">
                    <p className="text-sm text-mentor-muted">FAQ를 불러오고 있습니다.</p>
                  </div>
                ) : faqItems.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-mentor-border px-6 py-14 text-center">
                    <p className="text-sm text-mentor-muted">등록된 FAQ가 아직 없습니다.</p>
                  </div>
                ) : (
                  visibleFaqItems.map((faqItem) => {
                    const isOpened = openedFaqId === faqItem.id;
                    return (
                      <article key={faqItem.id} className="rounded-3xl border border-mentor-border bg-mentor-surface">
                        <button
                          type="button"
                          onClick={() =>
                            setOpenedFaqId((prev) => (prev === faqItem.id ? '' : faqItem.id))
                          }
                          className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
                        >
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-mentor-primary">
                              {faqItem.category}
                            </p>
                            <p className="mt-2 text-sm font-semibold text-mentor-text">
                              {faqItem.question}
                            </p>
                          </div>
                          <span className="text-sm font-semibold text-mentor-muted">
                            {isOpened ? '닫기' : '열기'}
                          </span>
                        </button>
                        {isOpened && (
                          <div className="border-t border-mentor-border px-5 py-4">
                            <p className="text-sm leading-7 text-mentor-muted">{faqItem.answer}</p>
                          </div>
                        )}
                      </article>
                    );
                  })
                )}
              </div>

              {faqTotalPages > 1 && (
                <div className="mt-6 flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setFaqPage((prev) => prev - 1)}
                    disabled={faqPage <= 0}
                    className="rounded-full bg-mentor-bg px-3 py-1.5 text-xs font-semibold text-mentor-muted transition hover:bg-mentor-border disabled:opacity-40"
                  >
                    이전
                  </button>
                  {Array.from({ length: faqTotalPages }, (_, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => setFaqPage(index)}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                        index === faqPage
                          ? 'bg-mentor-primary text-white'
                          : 'bg-mentor-bg text-mentor-muted hover:bg-mentor-border'
                      }`}
                    >
                      {index + 1}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setFaqPage((prev) => prev + 1)}
                    disabled={faqPage >= faqTotalPages - 1}
                    className="rounded-full bg-mentor-bg px-3 py-1.5 text-xs font-semibold text-mentor-muted transition hover:bg-mentor-border disabled:opacity-40"
                  >
                    다음
                  </button>
                </div>
              )}
            </section>

            {/* 공개 문의 섹션 */}
            <section className="rounded-3xl bg-mentor-surface p-6 shadow-[var(--shadow-card)]">
              <h2 className="text-xl font-bold text-mentor-text">공개 문의</h2>
              <p className="mt-1 text-sm text-mentor-muted">
                다른 사용자의 공개 문의와 답변을 확인할 수 있습니다. 도움이 됐다면 '도움됨' 버튼을 눌러주세요. 도움됨 20개 이상이면 FAQ 승격 대상이 됩니다.</p>
              <p className="mt-1 text-sm text-mentor-muted">내 문의 등록 시 공개로 선택한 문의만 이 목록에 표시되며 욕설, 개인정보 등 부적절한 내용이 포함된 문의는 관리자에 의해 삭제될 수 있습니다.
              </p>

              <div className="mt-6 space-y-4">
                {isLoadingPublic ? (
                  <div className="rounded-2xl border border-dashed border-mentor-border px-6 py-14 text-center">
                    <p className="text-sm text-mentor-muted">공개 문의를 불러오고 있습니다.</p>
                  </div>
                ) : publicInquiries.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-mentor-border px-6 py-14 text-center">
                    <p className="text-sm text-mentor-muted">공개 문의가 아직 없습니다.</p>
                  </div>
                ) : (
                  publicInquiries.map((inquiry) => (
                    <article key={inquiry.id} className="rounded-3xl border border-mentor-border p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-semibold text-mentor-text">
                            {inquiry.title || '(제목 없음)'}
                          </h3>
                          <p className="mt-1 text-xs text-mentor-muted">
                            {inquiry.userName || '익명'} · {formatDate(inquiry.createdAt)}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            inquiry.answered
                              ? 'bg-emerald-50 text-emerald-600'
                              : 'bg-amber-50 text-amber-600'
                          }`}
                        >
                          {resolveStatusLabel(inquiry)}
                        </span>
                      </div>

                      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-mentor-muted">
                        {inquiry.content}
                      </p>

                      {inquiry.reply && (
                        <div className="mt-4 rounded-2xl bg-mentor-bg px-4 py-4">
                          <p className="text-xs font-semibold text-mentor-primary">관리자 답변</p>
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-mentor-muted">
                            {inquiry.reply}
                          </p>
                        </div>
                      )}

                      <div className="mt-3 flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => handleHelpful(inquiry.id)}
                          disabled={helpfulLoading[inquiry.id]}
                          className="flex items-center gap-1.5 rounded-full border border-mentor-border px-3 py-1.5 text-xs font-semibold text-mentor-muted transition hover:border-mentor-primary hover:text-mentor-primary"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                          </svg>
                          도움됨 {inquiry.helpfulCount > 0 && `(${inquiry.helpfulCount})`}
                        </button>
                        {inquiry.helpfulCount >= 20 && (
                          <span className="text-xs text-mentor-primary font-semibold">FAQ 승격 대상</span>
                        )}
                      </div>
                    </article>
                  ))
                )}

                {/* 페이징 */}
                {publicTotalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => refreshPublicInquiries(publicPage - 1)}
                      disabled={publicPage <= 0}
                      className="rounded-full bg-mentor-bg px-3 py-1.5 text-xs font-semibold text-mentor-muted transition hover:bg-mentor-border disabled:opacity-40"
                    >
                      이전
                    </button>
                    {Array.from({ length: publicTotalPages }, (_, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => refreshPublicInquiries(i)}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                          i === publicPage
                            ? 'bg-mentor-primary text-white'
                            : 'bg-mentor-bg text-mentor-muted hover:bg-mentor-border'
                        }`}
                      >
                        {i + 1}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => refreshPublicInquiries(publicPage + 1)}
                      disabled={publicPage >= publicTotalPages - 1}
                      className="rounded-full bg-mentor-bg px-3 py-1.5 text-xs font-semibold text-mentor-muted transition hover:bg-mentor-border disabled:opacity-40"
                    >
                      다음
                    </button>
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* 우측: 문의 등록 + 내 문의 내역 */}
          <div className="space-y-6">
            <section className="rounded-3xl bg-mentor-surface p-6 shadow-[var(--shadow-card)]">
              <h2 className="text-xl font-bold text-mentor-text">문의 등록</h2>
              <p className="mt-1 text-sm text-mentor-muted">
                해결되지 않은 내용은 제목과 상세 설명을 남겨주세요. 관리자 답변 상태는 아래 내 문의 내역에서 바로 확인할 수 있습니다.
              </p>

              <div className="mt-6 space-y-4 rounded-3xl bg-mentor-bg p-5">
                <Field
                  label="문의 제목"
                  value={newInquiry.title}
                  onChange={(value) =>
                    setNewInquiry((prev) => ({ ...prev, title: value }))
                  }
                />
                <TextAreaField
                  label="문의 내용"
                  value={newInquiry.content}
                  onChange={(value) =>
                    setNewInquiry((prev) => ({ ...prev, content: value }))
                  }
                />

                {/* 공개/비밀글 토글 */}
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-mentor-text">공개 설정</span>
                  <div className="flex rounded-xl border border-mentor-border overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setNewInquiry((prev) => ({ ...prev, isPublic: false }))}
                      className={`px-4 py-2 text-xs font-semibold transition ${
                        !newInquiry.isPublic
                          ? 'bg-mentor-primary text-white'
                          : 'bg-white text-mentor-muted hover:bg-mentor-bg'
                      }`}
                    >
                      비밀글
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewInquiry((prev) => ({ ...prev, isPublic: true }))}
                      className={`px-4 py-2 text-xs font-semibold transition ${
                        newInquiry.isPublic
                          ? 'bg-mentor-primary text-white'
                          : 'bg-white text-mentor-muted hover:bg-mentor-bg'
                      }`}
                    >
                      공개글
                    </button>
                  </div>
                  <span className="text-xs text-mentor-muted">
                    {newInquiry.isPublic
                      ? '다른 사용자도 이 문의를 볼 수 있습니다.'
                      : '본인과 관리자만 볼 수 있습니다.'}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleCreateInquiry}
                  disabled={isSubmittingInquiry}
                  className="rounded-2xl bg-mentor-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-mentor-primary-dark"
                >
                  {isSubmittingInquiry ? '문의 등록 중...' : '문의 등록'}
                </button>
              </div>
            </section>

            <section className="rounded-3xl bg-mentor-surface p-6 shadow-[var(--shadow-card)]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-mentor-text">내 문의 내역</h2>

                </div>
                <button
                  type="button"
                  onClick={refreshInquiries}
                  className="rounded-full bg-mentor-bg px-4 py-2 text-sm font-semibold text-mentor-muted transition hover:bg-mentor-border"
                >
                  새로고침
                </button>
              </div>

              {isLoadingInquiries ? (
                <div className="mt-6 rounded-2xl border border-dashed border-mentor-border px-6 py-14 text-center">
                  <p className="text-sm text-mentor-muted">문의 내역을 불러오고 있습니다.</p>
                </div>
              ) : inquiries.length === 0 ? (
                <div className="mt-6 rounded-2xl border border-dashed border-mentor-border px-6 py-14 text-center">
                  <p className="text-sm text-mentor-muted">등록된 문의가 아직 없습니다.</p>
                </div>
              ) : (
                <div className="mt-6 space-y-4">
                  {visibleInquiries.map((inquiry) => (
                    <article key={inquiry.id} className="rounded-3xl border border-mentor-border p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold text-mentor-text">{inquiry.title}</h3>
                            {inquiry.isPublic && (
                              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-600">
                                공개
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-xs text-mentor-muted">{formatDate(inquiry.createdAt)}</p>
                        </div>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            inquiry.answered
                              ? 'bg-emerald-50 text-emerald-600'
                              : 'bg-amber-50 text-amber-600'
                          }`}
                        >
                          {resolveStatusLabel(inquiry)}
                        </span>
                      </div>

                      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-mentor-muted">
                        {inquiry.content}
                      </p>

                      <div className="mt-4 rounded-2xl bg-mentor-bg px-4 py-4">
                        <p className="text-xs font-semibold text-mentor-primary">관리자 답변</p>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-mentor-muted">
                          {inquiry.reply?.trim()
                            ? inquiry.reply
                            : '아직 답변이 등록되지 않았습니다. 답변 대기 상태로 표시됩니다.'}
                        </p>
                      </div>

                      <div className="mt-4 flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleDeleteInquiry(inquiry.id, inquiry.isPublic)}
                          disabled={deletingInquiryId === inquiry.id}
                          className="rounded-full border border-red-200 px-4 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                        >
                          {deletingInquiryId === inquiry.id ? '삭제 중...' : '문의 삭제'}
                        </button>
                      </div>
                    </article>
                  ))}

                  {myInquiryTotalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setMyInquiryPage((prev) => prev - 1)}
                        disabled={myInquiryPage <= 0}
                        className="rounded-full bg-mentor-bg px-3 py-1.5 text-xs font-semibold text-mentor-muted transition hover:bg-mentor-border disabled:opacity-40"
                      >
                        이전
                      </button>
                      {Array.from({ length: myInquiryTotalPages }, (_, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => setMyInquiryPage(index)}
                          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                            index === myInquiryPage
                              ? 'bg-mentor-primary text-white'
                              : 'bg-mentor-bg text-mentor-muted hover:bg-mentor-border'
                          }`}
                        >
                          {index + 1}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setMyInquiryPage((prev) => prev + 1)}
                        disabled={myInquiryPage >= myInquiryTotalPages - 1}
                        className="rounded-full bg-mentor-bg px-3 py-1.5 text-xs font-semibold text-mentor-muted transition hover:bg-mentor-border disabled:opacity-40"
                      >
                        다음
                      </button>
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-mentor-text">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-2xl border border-mentor-border px-4 py-3 text-sm outline-none transition focus:border-mentor-primary focus:ring-2 focus:ring-mentor-accent"
      />
    </label>
  );
}

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

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('ko-KR');
}
