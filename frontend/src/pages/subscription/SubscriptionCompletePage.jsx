import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import SubscriptionProgressSteps from '../../components/subscription/SubscriptionProgressSteps';
import { getSubscriptionDetail } from '../../api/subscription';
import { SUBSCRIPTION_STATUS_LABELS } from '../../data/subscriptionStatusLabels';

/**
 * 구독 결제 결과 화면입니다.
 *
 * [역할]
 * 승인, 실패, 취소 결과를 같은 화면에서 보여 주고
 * 다음 행동까지 자연스럽게 이어지게 안내합니다.
 */
export default function SubscriptionCompletePage() {
  const location = useLocation();
  const { subscriptionId } = useParams();

  const [subscriptionSummary, setSubscriptionSummary] = useState(
    () => location.state?.createdSubscription ?? null
  );
  const [loading, setLoading] = useState(!location.state?.createdSubscription);
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
            '구독 결과 정보를 불러오지 못했습니다.'
        );
      } finally {
        setLoading(false);
      }
    }

    fetchSubscriptionDetail();
  }, [subscriptionId, subscriptionSummary]);

  const resultMeta = useMemo(
    () => buildSubscriptionResultMeta(subscriptionSummary?.status),
    [subscriptionSummary?.status]
  );

  return (
    <div className="min-h-screen bg-mentor-bg px-4 py-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <SubscriptionProgressSteps currentStep={4} />

        {loading ? (
          <section className="rounded-[32px] bg-mentor-surface px-6 py-16 shadow-sm">
            <div className="flex justify-center">
              <span className="h-10 w-10 animate-spin rounded-full border-4 border-mentor-accent border-t-mentor-primary" />
            </div>
          </section>
        ) : error ? (
          <section className="rounded-[32px] bg-mentor-surface px-6 py-16 text-center shadow-sm">
            <p className="text-lg font-semibold text-mentor-text">구독 결과 정보를 불러오지 못했습니다.</p>
            <p className="mt-2 text-sm text-mentor-muted">{error}</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                to="/subscription"
                className="rounded-full bg-mentor-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-mentor-primary-dark"
              >
                구독 화면으로 이동
              </Link>
            </div>
          </section>
        ) : (
          <>
            <section className="rounded-[32px] bg-mentor-surface px-6 py-10 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-mentor-primary">{resultMeta.eyebrow}</p>
                  <h1 className="mt-3 text-3xl font-bold text-mentor-text">{resultMeta.title}</h1>
                  <p className="mt-3 text-sm leading-6 text-mentor-muted">
                    {resultMeta.description}
                  </p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${resultMeta.badgeClassName}`}>
                  {SUBSCRIPTION_STATUS_LABELS[subscriptionSummary?.status] ?? subscriptionSummary?.status ?? '확인 필요'}
                </span>
              </div>
            </section>

            {subscriptionSummary && (
              <section className="rounded-[32px] bg-mentor-surface px-6 py-8 shadow-sm">
                <div className="grid gap-4 md:grid-cols-3">
                  <InfoTile label="구독 요금제" value={subscriptionSummary.planName} />
                  <InfoTile
                    label="결제 금액"
                    value={formatPrice(subscriptionSummary.paymentAmount)}
                  />
                  <InfoTile
                    label="결제 수단"
                    value={formatPaymentMethod(subscriptionSummary.paymentMethod)}
                  />
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <InfoTile
                    label="시작일"
                    value={formatDateTime(subscriptionSummary.startedAt)}
                  />
                  <InfoTile
                    label="만료일"
                    value={formatDateTime(subscriptionSummary.expiresAt)}
                  />
                  <InfoTile
                    label="이용 기간"
                    value={`${subscriptionSummary.durationDays}일`}
                  />
                </div>

                <div className="mt-8 flex flex-wrap gap-3">
                  {resultMeta.actions}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function InfoTile({ label, value }) {
  return (
    <div className="rounded-3xl border border-mentor-border bg-mentor-bg px-5 py-5">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-mentor-muted">{label}</p>
      <p className="mt-3 text-sm font-semibold text-mentor-text">{value}</p>
    </div>
  );
}

/**
 * 구독 상태에 맞는 문구와 버튼을 만듭니다.
 */
function buildSubscriptionResultMeta(status) {
  if (status === 'ACTIVE') {
    return {
      eyebrow: '결제 완료',
      title: '구독이 정상적으로 시작되었습니다.',
      description:
        '결제 승인이 완료되어 구독이 활성화되었습니다. 이제 바로 학습과 면접으로 이어갈 수 있습니다.',
      badgeClassName: 'bg-emerald-50 text-emerald-600',
      actions: (
        <>
          <Link
            to="/learning"
            className="rounded-full bg-mentor-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-mentor-primary-dark"
          >
            학습하러 가기
          </Link>
          <Link
            to="/interview/setup"
            className="rounded-full bg-mentor-bg px-5 py-3 text-sm font-semibold text-mentor-text transition hover:bg-mentor-accent"
          >
            면접 시작하기
          </Link>
          <Link
            to="/subscription"
            className="rounded-full bg-mentor-bg px-5 py-3 text-sm font-semibold text-mentor-text transition hover:bg-mentor-accent"
          >
            구독 화면으로 돌아가기
          </Link>
        </>
      ),
    };
  }

  if (status === 'CANCELLED') {
    return {
      eyebrow: '결제 취소',
      title: '구독 결제가 취소되었습니다.',
      description:
        '선택한 구독 초안은 그대로 남겨 두었습니다. 다시 결제를 시도하거나 다른 요금제를 고를 수 있습니다.',
      badgeClassName: 'bg-amber-50 text-amber-700',
      actions: (
        <>
          <Link
            to="/subscription/payment"
            className="rounded-full bg-mentor-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-mentor-primary-dark"
          >
            결제 다시 시도
          </Link>
          <Link
            to="/subscription"
            className="rounded-full bg-mentor-bg px-5 py-3 text-sm font-semibold text-mentor-text transition hover:bg-mentor-accent"
          >
            구독 화면으로 이동
          </Link>
        </>
      ),
    };
  }

  if (status === 'PAYMENT_FAILED') {
    return {
      eyebrow: '결제 실패',
      title: '구독 결제 승인에 실패했습니다.',
      description:
        '기존 활성 구독이 있다면 그대로 유지되고, 새 결제 시도만 실패 상태로 남습니다. 결제 내용을 다시 확인한 뒤 재시도해 주세요.',
      badgeClassName: 'bg-rose-50 text-rose-600',
      actions: (
        <>
          <Link
            to="/subscription/payment"
            className="rounded-full bg-mentor-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-mentor-primary-dark"
          >
            결제 다시 시도
          </Link>
          <Link
            to="/subscription"
            className="rounded-full bg-mentor-bg px-5 py-3 text-sm font-semibold text-mentor-text transition hover:bg-mentor-accent"
          >
            구독 화면으로 이동
          </Link>
        </>
      ),
    };
  }

  return {
    eyebrow: '결제 결과 확인',
    title: '구독 결제 결과를 기다리고 있습니다.',
    description:
      '아직 결제 결과가 확정되지 않았습니다. 결제 결과 선택 화면으로 돌아가 승인 또는 취소 결과를 반영해 주세요.',
    badgeClassName: 'bg-slate-100 text-slate-600',
    actions: (
      <Link
        to="/subscription/payment"
        className="rounded-full bg-mentor-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-mentor-primary-dark"
      >
        결제 화면으로 돌아가기
      </Link>
    ),
  };
}

function formatPrice(value) {
  return `${value.toLocaleString('ko-KR')}원`;
}

function formatPaymentMethod(paymentMethod) {
  if (paymentMethod === 'KAKAOPAY') {
    return '카카오페이';
  }

  return paymentMethod ?? '-';
}

function formatDateTime(value) {
  if (!value) {
    return '-';
  }

  return new Date(value).toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
