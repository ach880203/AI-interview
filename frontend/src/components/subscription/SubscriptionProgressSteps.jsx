/**
 * 구독 진행 단계를 공통 카드로 보여 주는 컴포넌트입니다.
 *
 * [설계 이유]
 * 주문 흐름과 마찬가지로 구독도 단계가 보이면
 * 사용자가 지금 어느 화면에 있고 다음에 무엇을 하게 되는지 이해하기 쉬워집니다.
 */
export default function SubscriptionProgressSteps({ currentStep }) {
  const steps = [
    {
      stepNumber: '1',
      title: '구독 선택',
      description: '이용 기간과 요금제를 비교하고 현재 준비 기간에 맞는 플랜을 고르세요.',
    },
    {
      stepNumber: '2',
      title: '결제 준비',
      description: '선택한 구독 정보와 적용 범위를 확인하고 결제 전 마지막 구성을 정리합니다.',
    },
    {
      stepNumber: '3',
      title: '최종 확인',
      description: '구독 정보를 최종 확인 후 결제로 진입합니다.',
    },
    {
      stepNumber: '4',
      title: '구독 완료',
      description: '구독 시작일과 만료일을 확인하고 학습과 면접기능을 바로 이용하세요.',
    },
  ];

  return (
    <section className="rounded-[32px] bg-mentor-surface p-6 shadow-sm">
      <p className="text-sm font-semibold text-mentor-primary">구독 결제 순서</p>
      <div className="mt-6 grid gap-4 lg:grid-cols-4">
        {steps.map((step, index) => {
          const isCompleted = currentStep > index + 1;
          const isCurrent = currentStep === index + 1;

          return (
            <article
              key={step.stepNumber}
              className={`rounded-3xl border px-5 py-5 transition ${
                isCurrent
                  ? 'border-mentor-primary bg-mentor-accent/60 shadow-[var(--shadow-card)]'
                  : 'border-mentor-border bg-mentor-bg'
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-2xl text-sm font-bold ${
                    isCurrent || isCompleted
                      ? 'bg-mentor-primary text-white'
                      : 'bg-white text-mentor-muted'
                  }`}
                >
                  {step.stepNumber}
                </span>
                <div>
                  <p className="text-sm font-semibold text-mentor-text">{step.title}</p>
                  <p className="mt-1 text-xs text-mentor-muted">
                    {isCurrent ? '현재 단계' : isCompleted ? '이전 단계' : '다음 단계'}
                  </p>
                </div>
              </div>
              <p className="mt-4 text-sm leading-6 text-mentor-muted">{step.description}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
