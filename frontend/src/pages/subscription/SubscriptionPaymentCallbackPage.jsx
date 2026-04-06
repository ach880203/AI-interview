import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  applySubscriptionPaymentResult,
  getSubscriptionDetail,
} from '../../api/subscription';
import SubscriptionProgressSteps from '../../components/subscription/SubscriptionProgressSteps';
import { clearSubscriptionCheckoutDraft } from '../../data/subscriptionCheckoutStorage';
import { SUBSCRIPTION_STATUS_LABELS } from '../../data/subscriptionStatusLabels';

/**
 * 구독 결제 결과 선택 페이지입니다.
 *
 * [역할]
 * 실제 카카오페이 승인 콜백 대신
 * 승인 / 실패 / 취소를 직접 선택해 구독 상태 전환을 검증합니다.
 */
export default function SubscriptionPaymentCallbackPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { subscriptionId } = useParams();

  const [subscriptionSummary, setSubscriptionSummary] = useState(
    () => location.state?.createdSubscription ?? null
  );
  const [loading, setLoading] = useState(!location.state?.createdSubscription);
  const [submittingResult, setSubmittingResult] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchSubscriptionDetail() {
      if (!subscriptionId || subscriptionSummary) {
        return;
      }

      setLoading(true);
      setError('');

      try {
        const response = await getSubscriptionDetail(subscriptionId);
        setSubscriptionSummary(response.data?.data ?? response.data);
      } catch (requestError) {
        setError(
          requestError.response?.data?.error?.message ??
            '결제 대기 구독 정보를 불러오지 못했습니다.'
        );
      } finally {
        setLoading(false);
      }
    }

    fetchSubscriptionDetail();
  }, [subscriptionId, subscriptionSummary]);

  /**
   * 선택한 결제 결과를 서버에 반영합니다.
   *
   * [주의]
   * 승인일 때만 구독 초안을 비웁니다.
   * 실패나 취소에서는 다시 시도할 수 있어야 하므로 선택 정보는 남겨 둡니다.
   */
  async function handleSelectPaymentResult(resultType, reason) {
    if (!subscriptionId) {
      return;
    }

    setSubmittingResult(true);
    setError('');

    try {
      const response = await applySubscriptionPaymentResult(subscriptionId, {
        resultType,
        reason,
      });

      const updatedSubscription = response.data?.data ?? response.data;

      if (resultType === 'APPROVED') {
        clearSubscriptionCheckoutDraft();
      }

      navigate(`/subscription/complete/${updatedSubscription.id}`, {
        replace: true,
        state: { createdSubscription: updatedSubscription },
      });
    } catch (requestError) {
      setError(
        requestError.response?.data?.error?.message ??
          '구독 결제 결과를 반영하지 못했습니다.'
      );
    } finally {
      setSubmittingResult(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-mentor-bg px-4 py-10">
        <div className="mx-auto max-w-5xl space-y-6">
          <SubscriptionProgressSteps currentStep={3} />
          <section className="rounded-[32px] bg-mentor-surface px-6 py-20 shadow-sm">
            <div className="flex justify-center">
              <span className="h-10 w-10 animate-spin rounded-full border-4 border-mentor-accent border-t-mentor-primary" />
            </div>
          </section>
        </div>
      </div>
    );
  }

  if (error && !subscriptionSummary) {
    return (
      <div className="min-h-screen bg-mentor-bg px-4 py-10">
        <div className="mx-auto max-w-5xl space-y-6">
          <SubscriptionProgressSteps currentStep={3} />
          <section className="rounded-[32px] bg-mentor-surface px-6 py-20 text-center shadow-sm">
            <p className="text-lg font-semibold text-mentor-text">결제 대기 구독을 불러오지 못했습니다.</p>
            <p className="mt-2 text-sm text-mentor-muted">{error}</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                to="/subscription/payment"
                className="rounded-full bg-mentor-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-mentor-primary-dark"
              >
                결제 화면으로 돌아가기
              </Link>
              <Link
                to="/subscription"
                className="rounded-full bg-mentor-bg px-5 py-3 text-sm font-semibold text-mentor-text transition hover:bg-mentor-border"
              >
                구독 화면으로 이동
              </Link>
            </div>
          </section>
        </div>
      </div>
    );
  }

  const isPendingSubscription = subscriptionSummary?.status === 'PENDING';

  return (
    <div className="min-h-screen bg-mentor-bg px-4 py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-[32px] bg-mentor-surface p-7 shadow-sm">
          <p className="text-sm font-semibold text-mentor-primary">모의 결제 결과</p>
          <h1 className="mt-3 text-3xl font-bold text-mentor-text">
            카카오페이 결제 결과를 선택해 구독 상태를 반영해 주세요.
          </h1>
          <p className="mt-3 text-sm leading-6 text-mentor-muted">
            실제 PG가 연결되면 이 단계는 승인 콜백이 대신 처리합니다. 지금은 결과를 직접 선택해
            결제 대기, 승인, 실패, 취소 흐름이 모두 화면에 남는지 확인합니다.
          </p>
        </section>

        <SubscriptionProgressSteps currentStep={3} />

        {error && (
          <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
        )}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="rounded-[28px] bg-mentor-surface p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-mentor-primary">결제 대기 구독</p>
                <h2 className="mt-2 text-2xl font-bold text-mentor-text">
                  {subscriptionSummary?.planName}
                </h2>
                <p className="mt-2 text-sm text-mentor-muted">
                  현재 상태: {SUBSCRIPTION_STATUS_LABELS[subscriptionSummary?.status] ?? subscriptionSummary?.status}
                </p>
              </div>
              <span className="rounded-full bg-mentor-accent px-3 py-1 text-xs font-semibold text-mentor-primary">
                {formatPaymentMethod(subscriptionSummary?.paymentMethod)}
              </span>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <DetailTile label="요금제" value={subscriptionSummary?.planName} />
              <DetailTile
                label="결제 금액"
                value={`${(subscriptionSummary?.paymentAmount ?? 0).toLocaleString('ko-KR')}원`}
              />
              <DetailTile label="이용 기간" value={`${subscriptionSummary?.durationDays ?? 0}일`} />
              <DetailTile label="시작 기준" value="결제 승인 시점" />
            </div>
          </section>

          <aside className="space-y-4">
            <section className="rounded-[28px] bg-mentor-primary p-6 text-white shadow-sm">
              <h2 className="text-lg font-bold">결제 결과 선택</h2>
              <p className="mt-3 text-sm leading-6 text-white/80">
                승인되면 구독이 활성화되고, 실패나 취소는 별도 상태로 기록됩니다.
                기존 활성 구독은 승인될 때만 만료 처리됩니다.
              </p>

              {isPendingSubscription ? (
                <div className="mt-6 space-y-3">
                  <button
                    type="button"
                    onClick={() =>
                      handleSelectPaymentResult('APPROVED', '카카오페이 구독 결제가 정상 승인되었습니다.')
                    }
                    disabled={submittingResult}
                    className="w-full rounded-2xl bg-mentor-surface px-4 py-3 text-sm font-semibold text-mentor-text transition hover:bg-mentor-bg disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submittingResult ? '결제 결과 반영 중...' : '결제 승인 처리'}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleSelectPaymentResult('FAILED', '카카오페이 구독 결제 승인에 실패했습니다.')
                    }
                    disabled={submittingResult}
                    className="w-full rounded-2xl border border-white/20 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    결제 실패 처리
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleSelectPaymentResult('CANCELLED', '사용자가 구독 결제를 취소했습니다.')
                    }
                    disabled={submittingResult}
                    className="w-full rounded-2xl border border-white/20 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    결제 취소 처리
                  </button>
                </div>
              ) : (
                <div className="mt-6 rounded-2xl bg-white/10 px-4 py-4 text-sm leading-6 text-white/85">
                  이 구독은 이미 {SUBSCRIPTION_STATUS_LABELS[subscriptionSummary?.status] ?? subscriptionSummary?.status} 상태입니다.
                  결과 화면에서 최신 내용을 확인해 주세요.
                </div>
              )}

              <div className="mt-6 flex flex-col gap-3">
                {!isPendingSubscription && (
                  <Link
                    to={`/subscription/complete/${subscriptionSummary?.id}`}
                    className="inline-flex justify-center rounded-2xl bg-mentor-surface px-4 py-3 text-sm font-semibold text-mentor-text transition hover:bg-mentor-bg"
                  >
                    결과 화면으로 이동
                  </Link>
                )}
                <Link
                  to="/subscription/payment"
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
