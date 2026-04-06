import { Link, Navigate, useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import SubscriptionProgressSteps from '../../components/subscription/SubscriptionProgressSteps';
import {
  SUBSCRIPTION_PAYMENT_METHOD,
  findSubscriptionPlan,
} from '../../data/subscriptionPlans';
import {
  loadSubscriptionCheckoutDraft,
  saveSubscriptionCheckoutDraft,
} from '../../data/subscriptionCheckoutStorage';

/**
 * 구독 결제 준비 화면입니다.
 *
 * [역할]
 * 사용자가 방금 선택한 요금제를 다시 확인하고,
 * 결제 전에 적용 범위와 결제 수단을 이해할 수 있게 돕습니다.
 */
export default function SubscriptionCheckoutPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);

  const checkoutDraft = loadSubscriptionCheckoutDraft();
  const selectedPlan = findSubscriptionPlan(checkoutDraft?.planKey);

  if (!selectedPlan) {
    return <Navigate to="/subscription" replace />;
  }

  /**
   * 다음 단계에서도 동일한 요금제 선택이 유지되도록
   * 현재 시점 정보를 다시 저장하고 결제 확인 화면으로 이동합니다.
   */
  function handleMoveToPaymentPage() {
    saveSubscriptionCheckoutDraft({
      ...checkoutDraft,
      planKey: selectedPlan.key,
      confirmedAt: new Date().toISOString(),
    });

    navigate('/subscription/payment');
  }

  return (
    <div className="min-h-screen bg-mentor-bg px-4 py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-[32px] bg-mentor-surface p-7 shadow-sm">
          <p className="text-sm font-semibold text-mentor-primary">구독 준비</p>
          <h1 className="mt-3 text-3xl font-bold text-mentor-text">
            선택한 구독 정보를 확인하고 결제 단계로 이동해 주세요.
          </h1>
          <p className="mt-3 text-sm leading-6 text-mentor-muted">
            구독은 도서 주문과 분리된 전용 결제 흐름으로 운영합니다. 현재 선택한 기간과 적용 범위를
            먼저 확인한 뒤 결제 단계로 넘어갑니다.
          </p>
        </section>

        <SubscriptionProgressSteps currentStep={2} />

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="space-y-4">
            <section className="rounded-[28px] bg-mentor-surface p-6 shadow-sm">
              <h2 className="text-lg font-bold text-mentor-text">선택한 구독 요금제</h2>
              <div className="mt-5 rounded-[28px] border border-mentor-primary bg-mentor-accent/60 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-mentor-primary">{selectedPlan.name}</p>
                    <p className="mt-2 text-3xl font-bold text-mentor-text">
                      {formatPrice(selectedPlan.paymentAmount)}
                    </p>
                    <p className="mt-2 text-sm text-mentor-muted">{selectedPlan.durationText}</p>
                  </div>
                  {selectedPlan.recommended && (
                    <span className="rounded-full bg-mentor-primary px-3 py-1 text-xs font-semibold text-white">
                      추천
                    </span>
                  )}
                </div>

                <p className="mt-4 text-sm leading-6 text-mentor-muted">
                  {selectedPlan.description}
                </p>

                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  <SubscriptionInfoTile label="핵심 포인트" value={selectedPlan.highlight} />
                  <SubscriptionInfoTile label="이용 기간" value={`${selectedPlan.durationDays}일`} />
                  <SubscriptionInfoTile label="할인 안내" value={selectedPlan.discountText} />
                </div>
              </div>
            </section>

            <section className="rounded-[28px] bg-mentor-surface p-6 shadow-sm">
              <h2 className="text-lg font-bold text-mentor-text">적용 대상 확인</h2>
              <p className="mt-1 text-sm text-mentor-muted">
                구독이 시작되면 아래 계정으로 학습과 면접 기능이 바로 연결됩니다.
              </p>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <SubscriptionInfoTile label="이용자 이름" value={user?.name ?? '로그인 정보 없음'} />
                <SubscriptionInfoTile label="이용자 이메일" value={user?.email ?? '로그인 정보 없음'} />
              </div>
            </section>
          </section>

          <aside className="space-y-4">
            <section className="rounded-[28px] bg-mentor-surface p-6 shadow-sm">
              <h2 className="text-lg font-bold text-mentor-text">결제 수단</h2>
              <div className="mt-5 rounded-2xl border border-mentor-primary bg-mentor-accent/60 px-4 py-4">
                <p className="text-sm font-semibold text-mentor-text">{SUBSCRIPTION_PAYMENT_METHOD.label}</p>
                <p className="mt-1 text-xs leading-5 text-mentor-muted">
                  {SUBSCRIPTION_PAYMENT_METHOD.description}
                </p>
              </div>
            </section>

            <section className="rounded-[28px] bg-mentor-primary p-6 text-white shadow-sm">
              <h2 className="text-lg font-bold">결제 전 요약</h2>
              <div className="mt-5 space-y-3 text-sm">
                <SummaryRow label="선택 요금제" value={selectedPlan.name} />
                <SummaryRow label="이용 기간" value={selectedPlan.durationText} />
                <SummaryRow label="결제 수단" value={SUBSCRIPTION_PAYMENT_METHOD.label} />
              </div>

              <div className="mt-5 border-t border-white/10 pt-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-white/70">결제 예정 금액</span>
                  <span className="text-2xl font-bold">{formatPrice(selectedPlan.paymentAmount)}</span>
                </div>
                <p className="mt-2 text-xs text-white/70">
                  결제 단계에서 다시 한 번 구독 시작일과 만료일을 확인한 뒤 최종 저장합니다.
                </p>
              </div>

              <button
                type="button"
                onClick={handleMoveToPaymentPage}
                className="mt-5 w-full rounded-2xl bg-mentor-surface px-4 py-3 text-sm font-semibold text-mentor-text transition hover:bg-mentor-bg"
              >
                결제 확인 화면으로 이동
              </button>

              <Link
                to="/subscription"
                className="mt-3 inline-flex w-full justify-center rounded-2xl border border-white/20 px-4 py-3 text-sm font-semibold text-white/90 transition hover:bg-white/10"
              >
                요금제 다시 선택
              </Link>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}

function SubscriptionInfoTile({ label, value }) {
  return (
    <div className="rounded-3xl border border-mentor-border bg-mentor-bg px-5 py-5">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-mentor-muted">{label}</p>
      <p className="mt-3 text-sm font-semibold text-mentor-text">{value}</p>
    </div>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-white/70">{label}</span>
      <span className="max-w-[180px] text-right font-semibold text-white">{value}</span>
    </div>
  );
}

function formatPrice(value) {
  return `${value.toLocaleString('ko-KR')}원`;
}
