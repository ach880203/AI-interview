/**
 * 도서 주문 단계 표시 컴포넌트입니다.
 *
 * [역할]
 * 장바구니, 주문서, 결제, 주문 완료가 어떤 순서로 이어지는지
 * 모든 화면에서 같은 기준으로 보여 주기 위해 공통으로 사용합니다.
 *
 * [주의]
 * 디자인은 기존 mentor 계열 카드와 배지 톤을 그대로 따라가
 * 홈페이지와 다른 분위기로 튀지 않게 유지합니다.
 */
export default function OrderProgressSteps({ currentStep }) {
  const steps = [
    { stepNumber: '1', title: '장바구니', description: '상품과 수량을 확인합니다.' },
    { stepNumber: '2', title: '주문서', description: '주문자와 배송 정보를 입력합니다.' },
    { stepNumber: '3', title: '결제 진행', description: '결제 수단과 최종 금액을 확인합니다.' },
    { stepNumber: '4', title: '주문 완료', description: '주문 번호와 후속 이동 경로를 확인합니다.' },
  ];

  return (
    <section className="rounded-[32px] bg-mentor-surface p-6 shadow-sm">
      <p className="text-sm font-semibold text-mentor-primary">주문 흐름 안내</p>
      <h2 className="mt-2 text-xl font-bold text-mentor-text">현재 주문 단계가 어디인지 한눈에 확인할 수 있습니다.</h2>
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
