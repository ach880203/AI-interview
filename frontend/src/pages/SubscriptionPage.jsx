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
  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto max-w-6xl space-y-8">
        <section className="rounded-[32px] bg-slate-900 px-7 py-10 text-white shadow-xl">
          <p className="text-sm font-semibold text-slate-300">구독 서비스</p>
          <h1 className="mt-3 text-3xl font-bold">준비 기간에 맞춰 구독 기간을 선택하세요.</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
            단기 체험부터 장기 취업 준비까지 한 번에 비교할 수 있도록 요금과 할인 폭을 정리했습니다.
          </p>
        </section>

        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-700 flex items-center gap-3">
          <span className="text-lg">🚧</span>
          <p>
            <span className="font-semibold">구독 결제 기능은 현재 준비 중입니다.</span>{' '}
            결제 시스템 연동 후 이용하실 수 있습니다.
          </p>
        </div>

        <section className="grid gap-5 lg:grid-cols-4">
          {SUBSCRIPTION_PLANS.map((plan) => (
            <article
              key={plan.key}
              className={`relative rounded-[28px] border p-6 shadow-sm transition ${
                plan.recommended
                  ? 'border-indigo-500 bg-white shadow-lg'
                  : 'border-gray-200 bg-white hover:-translate-y-1 hover:shadow-md'
              }`}
            >
              {plan.recommended && (
                <span className="absolute right-5 top-5 rounded-full bg-indigo-600 px-3 py-1 text-xs font-semibold text-white">
                  추천
                </span>
              )}

              <p className="text-sm font-semibold text-slate-500">{plan.name}</p>
              <h2 className="mt-2 text-3xl font-bold text-slate-900">
                {formatPrice(plan.finalPrice)}
              </h2>
              <p className="mt-2 text-sm text-slate-500">{plan.periodText}</p>

              <div className="mt-6 rounded-2xl bg-slate-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  혜택
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-800">{plan.highlight}</p>
                <p className="mt-2 text-sm text-indigo-600">{plan.discountText}</p>
                <p className="mt-1 text-xs text-slate-400">
                  정가 {formatPrice(plan.basePrice)}
                </p>
              </div>

              <button
                type="button"
                disabled
                className="mt-6 w-full rounded-2xl bg-slate-200 px-4 py-3 text-sm font-semibold text-slate-400 cursor-not-allowed"
              >
                준비 중
              </button>

              <p className="mt-3 text-center text-xs text-slate-400">
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
 * 원화 금액을 보기 쉽게 포맷합니다.
 */
function formatPrice(value) {
  return `${value.toLocaleString('ko-KR')}원`;
}
