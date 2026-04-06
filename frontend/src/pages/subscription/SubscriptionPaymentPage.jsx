import * as PortOne from '@portone/browser-sdk/v2';
import { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import SubscriptionProgressSteps from '../../components/subscription/SubscriptionProgressSteps';
import { createSubscription, verifySubscriptionPayment } from '../../api/subscription';
import {
  SUBSCRIPTION_PAYMENT_METHOD,
  findSubscriptionPlan,
} from '../../data/subscriptionPlans';
import { loadSubscriptionCheckoutDraft, clearSubscriptionCheckoutDraft } from '../../data/subscriptionCheckoutStorage';

/** PortOne 스토어 ID가 설정되어 있으면 실제 결제창을 사용합니다. */
const PORTONE_STORE_ID = import.meta.env.VITE_PORTONE_STORE_ID;
const PORTONE_CHANNEL_KEY = import.meta.env.VITE_PORTONE_CHANNEL_KEY;

/**
 * 구독 결제 확인 화면입니다.
 *
 * [역할]
 * 선택한 요금제를 마지막으로 확인하고,
 * 결제 대기 구독을 생성한 뒤 결제를 진행합니다.
 *
 * [PortOne V2 흐름]
 * 1. 구독 생성 (PENDING)
 * 2. PortOne SDK requestPayment() 호출 → 카카오페이 결제창
 * 3. 결제 완료 후 paymentId를 백엔드에 전송
 * 4. 백엔드에서 PortOne API 직접 조회 → 금액·상태 검증 → ACTIVE 확정
 *
 * [분기]
 * - VITE_PORTONE_STORE_ID가 설정된 경우: PortOne SDK 실제 결제창 호출
 * - 설정되지 않은 경우: 모의 결제 콜백 페이지로 이동 (로컬 개발용)
 */
export default function SubscriptionPaymentPage() {
  const navigate = useNavigate();
  const [paymentDraft] = useState(() => loadSubscriptionCheckoutDraft());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const selectedPlan = useMemo(
    () => findSubscriptionPlan(paymentDraft?.planKey),
    [paymentDraft?.planKey]
  );

  if (!selectedPlan) {
    return <Navigate to="/subscription" replace />;
  }

  /**
   * 결제를 시작합니다.
   *
   * PORTONE_STORE_ID 설정 여부에 따라 실제 결제와 모의 결제로 분기합니다.
   */
  async function handleStartPayment() {
    setSubmitting(true);
    setError('');

    try {
      // 1단계: 결제 대기 구독 생성
      const response = await createSubscription({
        planKey: selectedPlan.key,
        paymentMethod: SUBSCRIPTION_PAYMENT_METHOD.key,
      });

      const createdSubscription = response.data?.data ?? response.data;

      // 2단계: PortOne 설정 여부에 따라 분기
      if (PORTONE_STORE_ID) {
        await handlePortOnePayment(createdSubscription);
      } else {
        // 모의 결제 흐름 (로컬 개발용)
        navigate(`/subscription/payment/callback/${createdSubscription.id}`, {
          replace: true,
          state: { createdSubscription },
        });
      }
    } catch (requestError) {
      if (requestError?.isPortOneError) {
        return; // PortOne 에러는 내부에서 이미 처리됨
      }
      setError(
        requestError.response?.data?.error?.message ??
          '구독 결제 준비 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  /**
   * PortOne SDK로 실제 결제창을 호출하고 결과를 검증합니다.
   *
   * [paymentId 형식]
   * "sub_{subscriptionId}_{timestamp}" — PortOne에서 각 결제를 식별하는 고유 ID
   */
  async function handlePortOnePayment(createdSubscription) {
    const paymentId = `sub_${createdSubscription.id}_${Date.now()}`;

    const paymentResponse = await PortOne.requestPayment({
      storeId: PORTONE_STORE_ID,
      channelKey: PORTONE_CHANNEL_KEY,
      paymentId,
      orderName: `AI멘토 구독 — ${selectedPlan.name}`,
      totalAmount: createdSubscription.paymentAmount,
      currency: 'CURRENCY_KRW',
      payMethod: 'EASY_PAY',
      easyPay: { easyPayProvider: 'EASY_PAY_PROVIDER_KAKAOPAY' },
    });

    if (paymentResponse?.code) {
      // 사용자가 결제창을 닫거나 결제 실패
      setError(`결제가 취소되었거나 실패했습니다. (${paymentResponse.message ?? paymentResponse.code})`);
      throw { isPortOneError: true };
    }

    // 3단계: 백엔드 서버사이드 검증
    const verifyResponse = await verifySubscriptionPayment(createdSubscription.id, { paymentId });
    const confirmedSubscription = verifyResponse.data?.data ?? verifyResponse.data;

    clearSubscriptionCheckoutDraft();

    navigate(`/subscription/complete/${confirmedSubscription.id}`, {
      replace: true,
      state: { createdSubscription: confirmedSubscription },
    });
  }

  return (
    <div className="min-h-screen bg-mentor-bg px-4 py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-[32px] bg-mentor-surface p-7 shadow-sm">
          <p className="text-sm font-semibold text-mentor-primary">결제 진행</p>
          <h1 className="mt-3 text-3xl font-bold text-mentor-text">
            구독 시작일과 결제 정보를 확인한 뒤 결제를 진행해 주세요.
          </h1>
          <p className="mt-3 text-sm leading-6 text-mentor-muted">
            먼저 결제 대기 구독을 만들고, 카카오페이 결제창으로 이동합니다.
            {PORTONE_STORE_ID
              ? ' 실제 카카오페이 결제창이 열립니다.'
              : ' (개발 환경: 모의 결제 결과 선택 화면으로 이동합니다.)'}
          </p>
        </section>

        <SubscriptionProgressSteps currentStep={3} />

        {error && (
          <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
        )}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="space-y-4">
            <section className="rounded-[28px] bg-mentor-surface p-6 shadow-sm">
              <h2 className="text-lg font-bold text-mentor-text">구독 적용 정보</h2>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <InfoTile label="선택 요금제" value={selectedPlan.name} />
                <InfoTile label="이용 기간" value={selectedPlan.durationText} />
                <InfoTile label="결제 수단" value={SUBSCRIPTION_PAYMENT_METHOD.label} />
                <InfoTile label="결제 금액" value={formatPrice(selectedPlan.paymentAmount)} />
              </div>
            </section>

            <section className="rounded-[28px] bg-mentor-surface p-6 shadow-sm">
              <h2 className="text-lg font-bold text-mentor-text">구독 시작 안내</h2>
              <div className="mt-5 rounded-[28px] border border-mentor-border bg-mentor-bg p-5">
                <p className="text-sm font-semibold text-mentor-text">{selectedPlan.highlight}</p>
                <p className="mt-3 text-sm leading-6 text-mentor-muted">
                  결제가 승인되면 그 시점을 기준으로 구독이 활성화됩니다. 그래서 결제 준비 단계에서
                  대기 시간이 조금 생겨도 실제 이용 시작일은 승인 시각에 맞춰 계산됩니다.
                </p>
                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  <InfoTile label="시작 기준" value="결제 승인 시점" />
                  <InfoTile label="예상 이용 기간" value={`${selectedPlan.durationDays}일`} />
                  <InfoTile label="연결 화면" value="학습 · 면접 · 마이페이지" />
                </div>
              </div>
            </section>
          </section>

          <aside className="space-y-4">
            <section className="rounded-[28px] bg-mentor-primary p-6 text-white shadow-sm">
              <h2 className="text-lg font-bold">최종 결제 확인</h2>
              <div className="mt-5 space-y-3 text-sm">
                <SummaryRow label="요금제" value={selectedPlan.name} />
                <SummaryRow label="이용 기간" value={selectedPlan.durationText} />
                <SummaryRow label="결제 수단" value={SUBSCRIPTION_PAYMENT_METHOD.label} />
              </div>

              <div className="mt-5 border-t border-white/10 pt-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-white/70">최종 결제 금액</span>
                  <span className="text-2xl font-bold">{formatPrice(selectedPlan.paymentAmount)}</span>
                </div>
                <p className="mt-2 text-xs text-white/70">
                  {PORTONE_STORE_ID
                    ? '카카오페이 결제창이 열립니다. 결제 완료 후 자동으로 구독이 활성화됩니다.'
                    : '다음 화면에서 승인, 실패, 취소 중 하나를 선택해 실제 결제 결과 흐름을 검증합니다.'}
                </p>
              </div>

              <button
                type="button"
                onClick={handleStartPayment}
                disabled={submitting}
                className="mt-5 w-full rounded-2xl bg-mentor-surface px-4 py-3 text-sm font-semibold text-mentor-text transition hover:bg-mentor-bg disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? '결제 준비 중...' : '카카오페이 결제창으로 이동'}
              </button>

              <Link
                to="/subscription/checkout"
                className="mt-3 inline-flex w-full justify-center rounded-2xl border border-white/20 px-4 py-3 text-sm font-semibold text-white/90 transition hover:bg-white/10"
              >
                구독 준비 화면으로 돌아가기
              </Link>
            </section>
          </aside>
        </div>
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
