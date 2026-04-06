import { Link } from 'react-router-dom';
import { SUBSCRIPTION_PLANS } from '../data/portalConfig';

/**
 * 구독 요금제 선택 페이지입니다.
 *
 * [역할]
 * 하루, 1주, 한 달, 1년 요금제를 한 화면에서 비교해 보여 줍니다.
 *
 * [주의]
 * 카드 결제 수수료 10%는 실제 청구 금액 계산과 분리해서 안내 문구로 유지합니다.
 * 사용자가 기본 요금과 수수료 정책을 동시에 이해할 수 있게 하기 위함입니다.
 */
export default function SubscriptionPage() {
  const subscriptionFlowSteps = [
    {
      stepNumber: '1',
      title: '구독 기간 선택',
      description: '하루, 1주, 한 달, 1년 중 준비 기간에 맞는 요금제를 고릅니다.',
    },
    {
      stepNumber: '2',
      title: '카카오페이 결제',
      description: '결제 수단은 카카오페이 중심으로 먼저 연결해 흐름을 단순하게 유지합니다.',
    },
    {
      stepNumber: '3',
      title: '이용 시작',
      description: '결제가 끝나면 학습과 면접 기능에서 바로 구독 상태를 확인할 수 있게 이어집니다.',
    },
  ];

  return (
    <div className="min-h-screen bg-mentor-bg px-4 py-10">
      <div className="mx-auto max-w-6xl space-y-8">
        {/* 헤더 — 밝은 파란 그라디언트 (어두운 배경 대신) */}
        <section className="rounded-[32px] bg-gradient-to-r from-mentor-primary to-mentor-sky px-7 py-10 text-white shadow-lg">
          <p className="text-sm font-semibold text-white/80">구독 서비스</p>
          <h1 className="mt-3 text-3xl font-bold">준비 기간에 맞춰 구독 기간을 선택하세요.</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/80">
            단기 체험부터 장기 취업 준비까지 한 번에 비교할 수 있도록 요금과 할인 폭을 정리했습니다.
          </p>
        </section>

        <section className="rounded-[28px] border border-mentor-border bg-mentor-surface p-6 shadow-sm">
          <p className="text-sm font-semibold text-mentor-primary">구독 이용 흐름</p>
          <h2 className="mt-2 text-xl font-bold text-mentor-text">도서 구매와 분리된 독립 구독 흐름으로 정리했습니다.</h2>
          <p className="mt-2 text-sm leading-6 text-mentor-muted">
            구독은 이제 도서 드롭다운 안의 부가 메뉴가 아니라, 학습과 면접을 묶는 별도 서비스로 이해할 수 있게 구성합니다.
          </p>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {subscriptionFlowSteps.map((step) => (
              <SubscriptionFlowStepCard
                key={step.stepNumber}
                stepNumber={step.stepNumber}
                title={step.title}
                description={step.description}
              />
            ))}
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-700">
          <div>
            <p className="font-semibold">구독 결제 연결은 준비 중이지만, 정보 구조와 요금 안내는 먼저 정리해 두었습니다.</p>
            <p className="mt-1">
              현재는 카카오페이 중심 흐름을 기준으로 화면 구조를 먼저 맞추고 있습니다.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/support"
              className="rounded-full border border-amber-300 bg-white px-4 py-2 font-semibold text-amber-700 transition hover:border-amber-400"
            >
              고객센터 문의
            </Link>
            <Link
              to="/books"
              className="rounded-full bg-mentor-primary px-4 py-2 font-semibold text-white transition hover:bg-mentor-primary-dark"
            >
              도서 보러 가기
            </Link>
          </div>
        </div>

        <section className="grid gap-5 lg:grid-cols-4">
          {SUBSCRIPTION_PLANS.map((plan) => (
            <article
              key={plan.key}
              className={`relative rounded-[28px] border p-6 shadow-sm transition ${
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
              <h2 className="mt-2 text-3xl font-bold text-mentor-text">
                {formatPrice(plan.finalPrice)}
              </h2>
              <p className="mt-2 text-sm text-mentor-muted">{plan.periodText}</p>

              <div className="mt-6 rounded-2xl bg-mentor-bg px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-mentor-muted">
                  혜택
                </p>
                <p className="mt-2 text-sm font-semibold text-mentor-text">{plan.highlight}</p>
                <p className="mt-2 text-sm text-mentor-primary">{plan.discountText}</p>
                <p className="mt-1 text-xs text-mentor-muted">
                  정가 {formatPrice(plan.basePrice)}
                </p>
              </div>

              <button
                type="button"
                disabled
                className="mt-6 w-full rounded-2xl bg-mentor-bg px-4 py-3 text-sm font-semibold text-mentor-muted cursor-not-allowed"
              >
                준비 중
              </button>

              <p className="mt-3 text-center text-xs text-mentor-muted">
                카드결제 수수료 10% 부가
              </p>
            </article>
          ))}
        </section>
      </div>
    </div>
  );
}

/**
 * 구독 단계 안내 카드입니다.
 *
 * [의도]
 * 구독이 단순 요금표가 아니라 실제 결제와 이용 시작으로 이어지는
 * 독립 서비스라는 점을 한눈에 설명하기 위해 분리했습니다.
 */
function SubscriptionFlowStepCard({ stepNumber, title, description }) {
  return (
    <article className="rounded-3xl border border-mentor-border bg-mentor-bg px-5 py-5">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-mentor-primary text-sm font-bold text-white">
          {stepNumber}
        </span>
        <p className="text-sm font-semibold text-mentor-text">{title}</p>
      </div>
      <p className="mt-4 text-sm leading-6 text-mentor-muted">{description}</p>
    </article>
  );
}

/**
 * 원화 금액을 보기 쉽게 포맷합니다.
 */
function formatPrice(value) {
  return `${value.toLocaleString('ko-KR')}원`;
}
