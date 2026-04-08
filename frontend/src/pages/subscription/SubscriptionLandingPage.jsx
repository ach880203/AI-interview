import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import SubscriptionProgressSteps from '../../components/subscription/SubscriptionProgressSteps';
import { getMySubscription } from '../../api/subscription';
import {
  SUBSCRIPTION_PAYMENT_METHOD,
  SUBSCRIPTION_PLAN_OPTIONS,
} from '../../data/subscriptionPlans';
import { saveSubscriptionCheckoutDraft } from '../../data/subscriptionCheckoutStorage';
import { SUBSCRIPTION_STATUS_LABELS } from '../../data/subscriptionStatusLabels';

/**
 * 구독 시작 화면입니다.
 *
 * [역할]
 * 현재 대표 구독 상태를 보여 주고,
 * 요금제를 선택해 결제 흐름을 시작합니다.
 */
export default function SubscriptionLandingPage() {
  const navigate = useNavigate();

  const [subscriptionSummary, setSubscriptionSummary] = useState(null);
  const [loadingSubscriptionSummary, setLoadingSubscriptionSummary] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let ignore = false;

    async function fetchSubscriptionSummary() {
      setLoadingSubscriptionSummary(true);
      setLoadError('');

      try {
        const response = await getMySubscription();
        const subscriptionData = extractSubscriptionResponse(response);

        if (!ignore) {
          setSubscriptionSummary(subscriptionData);
        }
      } catch (error) {
        if (!ignore) {
          setLoadError(
            error.response?.data?.error?.message ??
              '구독 상태를 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.'
          );
        }
      } finally {
        if (!ignore) {
          setLoadingSubscriptionSummary(false);
        }
      }
    }

    fetchSubscriptionSummary();

    return () => {
      ignore = true;
    };
  }, []);

  /**
   * 선택한 요금제를 다음 단계로 넘깁니다.
   *
   * [주의]
   * 새로고침해도 선택이 유지되도록 세션 저장소에 함께 저장합니다.
   */
  function handleSelectPlan(plan) {
    saveSubscriptionCheckoutDraft({
      planKey: plan.key,
      selectedAt: new Date().toISOString(),
    });

    navigate('/subscription/checkout');
  }

  return (
    <div className="min-h-screen bg-mentor-bg px-4 py-10">
      <div className="mx-auto max-w-6xl space-y-8">
        <section className="rounded-[32px] bg-gradient-to-r from-mentor-primary to-mentor-sky px-7 py-10 text-white shadow-lg">
          <p className="text-sm font-semibold text-white/80">구독 서비스</p>
          <h1 className="mt-3 text-3xl font-bold">준비 기간에 맞는 구독 기간을 선택해 주세요.</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/80">
            구독은 AI 면접과 학습 기능을 필요한 기간만큼 고른 뒤 결제하는 방식으로 운영됩니다. <br/>
            현재 준비 기간에 맞는 요금제를 선택하면, 바로 구독이 시작되고 면접과 학습 기능을 이용할 수 있습니다.
          </p>
        </section>

        <SubscriptionProgressSteps currentStep={1} />

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <article className="rounded-[28px] border border-mentor-border bg-mentor-surface p-6 shadow-sm">
            <p className="text-sm font-semibold text-mentor-primary">현재 구독 상태</p>

            {loadingSubscriptionSummary ? (
              <div className="mt-6 flex items-center justify-center py-12">
                <span className="h-8 w-8 animate-spin rounded-full border-4 border-mentor-accent border-t-mentor-primary" />
              </div>
            ) : loadError ? (
              <div className="mt-6 rounded-2xl bg-red-50 px-4 py-4 text-sm text-red-600">
                {loadError}
              </div>
            ) : subscriptionSummary ? (
              <div className="mt-6 rounded-[28px] border border-mentor-border bg-mentor-bg p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="mt-2 text-xl font-bold text-mentor-text">
                      {subscriptionSummary.planName}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-mentor-muted">
                      시작일 {formatDateTime(subscriptionSummary.startedAt)} · 만료일{' '}
                      {formatDateTime(subscriptionSummary.expiresAt)}
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusBadgeClassName(subscriptionSummary.status)}`}>
                    {SUBSCRIPTION_STATUS_LABELS[subscriptionSummary.status] ?? subscriptionSummary.status}
                  </span>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  <SubscriptionInfoTile
                    label="결제 금액"
                    value={formatPrice(subscriptionSummary.paymentAmount)}
                  />
                  <SubscriptionInfoTile
                    label="결제 수단"
                    value={formatPaymentMethod(subscriptionSummary.paymentMethod)}
                  />
                  <SubscriptionInfoTile
                    label="적용 기간"
                    value={`${subscriptionSummary.durationDays}일`}
                  />
                </div>
              </div>
            ) : (
              <div className="mt-6 rounded-[28px] border border-dashed border-mentor-border bg-mentor-bg px-6 py-12 text-center">
                <p className="text-base font-semibold text-mentor-text">아직 활성 구독이 없습니다.</p>
                <p className="mt-2 text-sm text-mentor-muted">
                  아래 요금제 중 하나를 선택하면 학습과 면접 기능으로 바로 이어서 사용할 수 있습니다.
                </p>
              </div>
            )}
          </article>

          <aside className="space-y-4">
            <section className="rounded-[28px] bg-mentor-surface p-6 shadow-sm">
              <h2 className="text-lg font-bold text-mentor-text">결제 선택</h2>
              <div className="mt-5 rounded-2xl border border-mentor-primary bg-mentor-accent/60 px-4 py-4">
                <p className="text-sm font-semibold text-mentor-text">
                  {SUBSCRIPTION_PAYMENT_METHOD.label}
                </p>
                <p className="mt-1 text-xs leading-5 text-mentor-muted">
                  {SUBSCRIPTION_PAYMENT_METHOD.description}
                </p>
              </div>
              <p className="mt-4 text-sm leading-6 text-mentor-muted">
                결제가 끝나면 구독 상태가 즉시 갱신되고, 학습과 면접 기능을 바로 이용할 수 있습니다.
              </p>
            </section>

            <section className="rounded-[28px] bg-amber-50 p-6 text-amber-800 shadow-sm">
              <h2 className="text-lg font-bold">궁금한 점이 있나요?</h2>
              <p className="mt-3 text-sm leading-6">
                결제 전에 궁금한 점이 있다면 고객센터에서 바로 확인할 수 있습니다.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Link
                  to="/support"
                  className="rounded-full border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-700 transition hover:border-amber-400"
                >
                  고객센터로 이동
                </Link>
              </div>
            </section>
          </aside>
        </section>

        <section className="grid gap-5 lg:grid-cols-4">
          {SUBSCRIPTION_PLAN_OPTIONS.map((plan) => (
            <article
              key={plan.key}
              className={`relative flex flex-col rounded-[28px] border p-6 shadow-sm transition ${
                plan.recommended
                  ? 'border-mentor-primary bg-mentor-surface shadow-[var(--shadow-card-hover)]'
                  : 'border-mentor-border bg-mentor-surface hover:-translate-y-1 hover:shadow-[var(--shadow-card-hover)]'
              }`}
            >
              {plan.recommended && (
                <span className="absolute right-5 top-5 rounded-full bg-mentor-primary px-3 py-1 text-xs font-semibold text-white">
                  추천
                </span>
              )}

              <p className="text-sm font-semibold text-mentor-muted">{plan.name}</p>
              <p className="mt-1 text-xs text-mentor-muted">{plan.durationText}</p>

              {/* 가격 영역 — 정가(취소선) 좌상단, 할인가 우하단 대각선 */}
              <div className="mt-4">
                {plan.discountRate > 0 ? (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-red-400 line-through decoration-red-400">
                        {formatPrice(plan.basePrice)}
                      </span>
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-600">
                        -{plan.discountRate}%
                      </span>
                    </div>
                    <div className="mt-1 flex justify-end">
                      <span className="text-2xl font-bold text-mentor-text">
                        {formatPrice(plan.supplyAmount)}
                      </span>
                    </div>
                  </>
                ) : (
                  <span className="text-2xl font-bold text-mentor-text">
                    {formatPrice(plan.supplyAmount)}
                  </span>
                )}
              </div>

              {/* 가격 상세 내역 */}
              <div className="mt-5 rounded-2xl bg-mentor-bg px-4 py-4 space-y-2 text-sm">
                {plan.discountRate > 0 && (
                  <div className="flex justify-between">
                    <span className="text-mentor-muted">할인</span>
                    <span className="font-semibold text-red-500">-{plan.discountRate}%</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-mentor-muted">정가</span>
                  <span className="text-mentor-text">{formatPrice(plan.basePrice)}</span>
                </div>
                {plan.discountRate > 0 && (
                  <div className="flex justify-between">
                    <span className="text-mentor-muted">할인가</span>
                    <span className="font-semibold text-mentor-primary">{formatPrice(plan.supplyAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-mentor-muted">부가세 (10%)</span>
                  <span className="text-mentor-text">{formatPrice(plan.vatAmount)}</span>
                </div>
                <div className="flex justify-between border-t border-mentor-border pt-2">
                  <span className="font-semibold text-mentor-text">총 결제금액</span>
                  <span className="font-bold text-mentor-primary">{formatPrice(plan.paymentAmount)}</span>
                </div>
              </div>

              <p className="mt-4 text-sm leading-6 text-mentor-muted">{plan.description}</p>

              <button
                type="button"
                onClick={() => handleSelectPlan(plan)}
                className={`mt-auto pt-5 w-full rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                  plan.recommended
                    ? 'bg-mentor-primary text-white hover:bg-mentor-primary-dark'
                    : 'bg-mentor-bg text-mentor-text hover:bg-mentor-accent'
                }`}
              >
                이 요금제로 진행
              </button>
            </article>
          ))}
        </section>
      </div>
    </div>
  );
}

function SubscriptionInfoTile({ label, value }) {
  return (
    <div className="rounded-3xl border border-mentor-border bg-white px-5 py-5">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-mentor-muted">{label}</p>
      <p className="mt-3 text-sm font-semibold text-mentor-text">{value}</p>
    </div>
  );
}

function formatPrice(value) {
  return `${value.toLocaleString('ko-KR')}원`;
}

function formatPaymentMethod(paymentMethod) {
  if (paymentMethod === 'KAKAOPAY') {
    return '카카오페이';
  }

  return paymentMethod ?? '확인 필요';
}

function formatDateTime(value) {
  if (!value) {
    return '확인 필요';
  }

  return new Date(value).toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getStatusBadgeClassName(status) {
  if (status === 'ACTIVE') {
    return 'bg-emerald-50 text-emerald-600';
  }

  if (status === 'PENDING') {
    return 'bg-amber-50 text-amber-700';
  }

  if (status === 'PAYMENT_FAILED') {
    return 'bg-rose-50 text-rose-600';
  }

  if (status === 'CANCELLED') {
    return 'bg-orange-50 text-orange-700';
  }

  return 'bg-slate-100 text-slate-600';
}

function extractSubscriptionResponse(response) {
  if (response?.data?.success === true) {
    return response.data.data ?? null;
  }

  return response?.data ?? null;
}
