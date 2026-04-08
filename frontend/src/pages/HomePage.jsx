import { Link } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import LandingNavbar from '../components/layout/LandingNavbar';

/* ────────────────────────────────────────────────────────────
   숫자 카운트업 훅
──────────────────────────────────────────────────────────── */
function useCountUp(target, duration = 1400, startSignal = true) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!startSignal) return;
    let frame = 0;
    const totalFrames = Math.round(duration / 16);
    const easeOut = (t) => 1 - Math.pow(1 - t, 3);
    const timer = setInterval(() => {
      frame++;
      setCount(Math.round(easeOut(frame / totalFrames) * target));
      if (frame >= totalFrames) clearInterval(timer);
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration, startSignal]);
  return count;
}

/* ────────────────────────────────────────────────────────────
   스크롤 감지 훅 (Intersection Observer)
──────────────────────────────────────────────────────────── */
function useInView(threshold = 0.2) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); observer.disconnect(); } },
      { threshold }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [threshold]);
  return [ref, inView];
}

/* ════════════════════════════════════════════════════════════
   홈 페이지
════════════════════════════════════════════════════════════ */
export default function HomePage() {
  const [statsRef, statsInView] = useInView(0.3);
  const c1 = useCountUp(2400, 1600, statsInView);
  const c2 = useCountUp(98, 1200, statsInView);
  const c3 = useCountUp(7, 800, statsInView);

  const scrollToFeatures = () => {
    document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-mentor-bg font-sans">
      <LandingNavbar />

      {/* ════════════════════════════════════════════════════
          Hero 섹션
      ════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden pt-16">
        {/* 배경 — 라이트 그라디언트 */}
        <div className="absolute inset-0 bg-gradient-to-br from-mentor-accent via-[#F0F7FE] to-mentor-bg" />
        {/* 장식 서클 */}
        <div className="absolute -top-32 -right-32 h-[500px] w-[500px] rounded-full bg-mentor-primary/8 blur-3xl" />
        <div className="absolute top-1/2 -left-20 h-64 w-64 rounded-full bg-blue-200/20 blur-2xl" />

        <div className="relative mx-auto max-w-6xl px-6 py-20 lg:py-28">
          <div className="grid items-center gap-14 lg:grid-cols-[1fr_480px]">

            {/* 좌측 텍스트 */}
            <div className="flex flex-col gap-7">
              {/* 배지 */}
              <div className="animate-fade-in-up inline-flex w-fit items-center gap-2 rounded-full border border-mentor-primary/25 bg-white px-4 py-1.5 text-sm font-semibold text-mentor-primary shadow-sm">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-mentor-primary" />
                GPT-4o 기반 AI 면접 코치
              </div>

              {/* 제목 */}
              <h1 className="animate-fade-in-up delay-100 text-4xl font-bold leading-[1.15] tracking-tight text-mentor-text lg:text-5xl xl:text-6xl">
                이력서를 분석하고
                <br />
                <span className="text-gradient">맞춤 면접 질문</span>을
                <br />
                실시간으로 생성합니다
              </h1>

              <p className="animate-fade-in-up delay-200 text-lg leading-relaxed text-mentor-muted">
                자기소개서·채용공고까지 함께 입력하면
                <br />
                AI가 맥락을 이해하고 심층 질문을 이어갑니다.
                <br />
                CS 학습과 약점 분석까지 한 플랫폼에서.
              </p>

              {/* CTA */}
              <div className="animate-fade-in-up delay-300 flex flex-wrap gap-4 pt-1">
                <Link
                  to="/auth/register"
                  className="inline-flex items-center gap-2 rounded-2xl bg-mentor-primary px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-mentor-primary/30 transition hover:bg-mentor-primary-dark hover:shadow-mentor-primary/40 active:scale-[0.98]"
                >
                  가입하기
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </Link>
                <button
                  onClick={scrollToFeatures}
                  className="inline-flex items-center gap-2 rounded-2xl border border-mentor-border bg-white px-8 py-3.5 text-base font-semibold text-mentor-muted shadow-sm transition hover:border-mentor-primary/30 hover:text-mentor-primary active:scale-[0.98]"
                >
                  기능 살펴보기
                </button>
              </div>

              {/* 체크 리스트 */}
              <ul className="animate-fade-in-up delay-400 flex flex-wrap gap-x-6 gap-y-2 pt-1">
                {['GPT-4o 기반 질문 생성', '기술·인성·압박·상황 유형 선택', 'CS 학습 + 약점 분석', '면접 피드백 리포트'].map((item) => (
                  <li key={item} className="flex items-center gap-1.5 text-sm text-mentor-muted">
                    <svg className="h-4 w-4 shrink-0 text-mentor-success" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* 우측 — 앱 미리보기 카드 */}
            <div className="animate-fade-in-right delay-200 relative flex flex-col gap-4">
              {/* 메인 카드: 면접 질문 */}
              <div className="animate-float relative rounded-3xl border border-mentor-border bg-white p-6 shadow-xl shadow-mentor-primary/8 ">
                {/* 헤더 */}
                <div className="mb-5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-mentor-primary text-[10px] font-black text-white">AI</div>
                    <span className="text-sm font-semibold text-mentor-text">AI 면접 진행 중</span>
                  </div>
                  <span className="rounded-full bg-mentor-accent px-2.5 py-0.5 text-xs font-semibold text-mentor-primary">2 / 5</span>
                </div>
                {/* 질문 */}
                <div className="mb-4 rounded-2xl bg-mentor-bg p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-mentor-primary mb-2">기술 질문</p>
                  <p className="text-sm font-medium leading-relaxed text-mentor-text">
                    이력서에 기재하신 Spring Boot 프로젝트에서 JPA N+1 문제를 어떻게 해결하셨나요?
                    구체적인 해결 방법과 성능 개선 수치를 함께 설명해 주세요.
                  </p>
                </div>
                {/* 입력 */}
                <div className="flex items-center gap-2 rounded-xl border border-mentor-border bg-mentor-bg px-4 py-2.5">
                  <span className="flex-1 text-sm text-mentor-muted">답변을 입력하세요...</span>
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-mentor-primary">
                    <svg className="h-3.5 w-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M3.105 2.288a.75.75 0 00-.826.95l1.903 6.557H13.5a.75.75 0 010 1.5H4.182l-1.903 6.557a.75.75 0 00.826.95 28.897 28.897 0 0015.208-7.444.75.75 0 000-1.116A28.897 28.897 0 003.105 2.288z" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* 우측 상단 플로팅: 문서 배지 */}
              <div className="animate-float-alt delay-300 absolute -top-4 -right-4 flex items-center gap-2 rounded-2xl border border-mentor-border bg-white px-4 py-2.5 shadow-lg ">
                <span className="text-base">📄</span>
                <div>
                  <p className="text-[11px] font-semibold text-mentor-text">이력서 연동됨</p>
                  <p className="text-[10px] text-mentor-muted">백엔드 개발자 이력서.pdf</p>
                </div>
              </div>

              {/* 피드백 요약 카드 */}
              <div className="animate-float delay-500 rounded-3xl border border-mentor-border bg-white p-5 shadow-lg shadow-mentor-primary/5 ">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-semibold text-mentor-text">AI 피드백 요약</p>
                  <span className="text-xs text-mentor-muted">방금 전</span>
                </div>
                <div className="flex items-center gap-4">
                  {/* 점수 링 */}
                  <div className="animate-pulse-ring relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-4 border-mentor-primary/20 bg-mentor-accent">
                    <span className="text-lg font-bold text-mentor-primary">82</span>
                  </div>
                  <div className="flex-1">
                    <div className="mb-2 flex gap-2">
                      {['논리력', '전문성', '전달력'].map((label, i) => (
                        <div key={label} className="flex-1">
                          <div className="mb-1 flex justify-between text-[10px] text-mentor-muted">
                            <span>{label}</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-mentor-border overflow-hidden">
                            <div
                              className="h-full rounded-full bg-mentor-primary transition-all"
                              style={{ width: `${[80, 85, 75][i]}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-[11px] leading-relaxed text-mentor-muted">
                      핵심 개념을 잘 짚었습니다. 수치 기반 근거를 추가하면 더 좋습니다.
                    </p>
                  </div>
                </div>
              </div>

              {/* 좌측 하단 플로팅: 과목 추천 */}
              <div className="animate-float-alt delay-700 absolute -bottom-3 -left-6 flex items-center gap-2 rounded-2xl border border-mentor-border bg-white px-4 py-2.5 shadow-lg ">
                <span className="text-base">🎯</span>
                <div>
                  <p className="text-[11px] font-semibold text-mentor-text">약점 감지</p>
                  <p className="text-[10px] text-mentor-muted">네트워크 집중 학습 추천</p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════
          통계 바
      ════════════════════════════════════════════════════ */}
      <section ref={statsRef} className="border-y border-mentor-border bg-white py-10">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            {[
              { value: c1, suffix: '+', label: '생성된 면접 질문', icon: '🎤' },
              { value: c2,  suffix: '%', label: '사용자 만족도',    icon: '⭐' },
              { value: c3,  suffix: '개', label: '학습 과목 제공',  icon: '📘' },
              { value: 24,  suffix: '/7', label: 'AI 상시 운영',    icon: '🤖', static: true },
            ].map(({ value, suffix, label, icon, static: isStatic }) => (
              <div key={label} className={`flex flex-col items-center gap-1 ${statsInView ? 'animate-fade-in-up' : 'opacity-0'}`}>
                <span className="mb-1 text-2xl">{icon}</span>
                <p className="text-3xl font-bold text-mentor-primary tabular-nums">
                  {isStatic ? value : value}{suffix}
                </p>
                <p className="text-sm text-mentor-muted">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════
          기능 소개
      ════════════════════════════════════════════════════ */}
      <section id="features" className="px-6 py-24 bg-mentor-bg">
        <div className="mx-auto max-w-6xl">
          <div className="mb-14 text-center">
            <p className="animate-fade-in-up mb-3 text-sm font-bold uppercase tracking-widest text-mentor-primary">
              Core Features
            </p>
            <h2 className="animate-fade-in-up delay-100 text-3xl font-bold text-mentor-text lg:text-4xl">
              면접 준비의 모든 것
            </h2>
            <p className="animate-fade-in-up delay-200 mt-3 text-mentor-muted">
              서류 분석부터 피드백, CS 학습까지 하나의 플랫폼에서 완성합니다.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature, i) => (
              <FeatureCard key={feature.title} {...feature} delay={i * 100} />
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════
          이용 흐름
      ════════════════════════════════════════════════════ */}
      <section className="bg-white px-6 py-24">
        <div className="mx-auto max-w-4xl">
          <div className="mb-14 text-center">
            <p className="mb-3 text-sm font-bold uppercase tracking-widest text-mentor-primary">
              How It Works
            </p>
            <h2 className="text-3xl font-bold text-mentor-text lg:text-4xl">
              3단계로 시작하세요
            </h2>
          </div>

          <div className="relative grid gap-10 lg:grid-cols-3 lg:gap-6">
            {/* 연결선 (데스크톱) */}
            <div className="absolute top-10 left-1/3 right-1/3 hidden h-px bg-gradient-to-r from-mentor-primary/40 via-mentor-primary/20 to-mentor-primary/40 lg:block" style={{ top: '2.5rem' }} />

            {STEPS.map((step, i) => (
              <StepCard key={step.title} step={step} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════
          프리미엄 서비스 강조
      ════════════════════════════════════════════════════ */}
      <section className="px-6 py-20 bg-mentor-bg">
        <div className="mx-auto max-w-4xl">
          <div className="overflow-hidden rounded-3xl bg-slate-900 shadow-2xl">
            {/* 상단 장식 바 */}
            <div className="h-1 bg-gradient-to-r from-mentor-primary via-blue-400 to-mentor-primary-light" />
            <div className="grid gap-8 px-10 py-14 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <p className="mb-3 text-sm font-bold uppercase tracking-widest text-mentor-primary-light">
                  Premium Service
                </p>
                <h2 className="mb-4 text-3xl font-bold text-white lg:text-4xl">
                  실전과 가장 가까운
                  <br />
                  AI 면접 경험
                </h2>
                <p className="mb-6 leading-relaxed text-slate-400">
                  AI가 이력서 내용을 기반으로 깊이 있는 후속 질문을 이어가고,
                  <br />
                  답변이 끝나면 강점·약점·개선 포인트를 상세히 분석합니다.
                </p>
                <ul className="flex flex-col gap-2">
                  {['맞춤형 면접 질문 무제한 생성', 'CS 학습 + 오답 노트 자동 정리', '과목별 약점 분석 + AI 추천 학습', '면접 이력 및 성장 그래프 제공'].map((item) => (
                    <li key={item} className="flex items-center gap-2.5 text-sm text-slate-300">
                      <svg className="h-4 w-4 shrink-0 text-mentor-primary" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex flex-col items-center gap-4 lg:items-end">
                <div className="rounded-2xl border border-white/10 bg-white/5 px-8 py-6 text-center backdrop-blur">
                  <p className="mb-1 text-sm text-slate-400">월 구독</p>
                  <p className="text-4xl font-bold text-white">₩19,500</p>
                  <p className="mt-1 text-xs text-slate-500">/ 월</p>
                </div>
                <Link
                  to="/auth/register"
                  className="w-full rounded-2xl bg-mentor-primary px-8 py-3.5 text-center text-base font-semibold text-white shadow-lg shadow-mentor-primary/30 transition hover:bg-mentor-primary-dark active:scale-[0.98]"
                >
                  가입하기
                </Link>
                <Link to="/auth/login" className="text-sm text-slate-500 transition hover:text-slate-300">
                  이미 계정이 있으신가요? 로그인
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════
          푸터
      ════════════════════════════════════════════════════ */}
      <footer className="border-t border-mentor-border bg-white px-6 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-mentor-primary text-[10px] font-black text-white">
              AI
            </div>
            <span className="text-sm font-bold text-mentor-text">Interview Mentor</span>
          </div>
          <p className="text-xs text-mentor-muted">© 2025 AI Interview Mentor. All rights reserved.</p>
          <div className="flex items-center gap-5 text-sm text-mentor-muted">
            <Link to="/auth/login"    className="transition hover:text-mentor-primary">로그인</Link>
            <Link to="/auth/register" className="transition hover:text-mentor-primary">가입하기</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   Feature Card
──────────────────────────────────────────────────────────── */
function FeatureCard({ icon, title, description, badge, delay }) {
  const [ref, inView] = useInView(0.15);
  return (
    <div
      ref={ref}
      className={`group rounded-2xl border border-mentor-border bg-white p-6 shadow-[var(--shadow-card)] transition hover:border-mentor-primary/30 hover:shadow-[var(--shadow-card-hover)] hover:-translate-y-1 ${inView ? 'animate-fade-in-up' : 'opacity-0'}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-mentor-accent text-2xl transition group-hover:scale-110">
          {icon}
        </div>
        {badge && (
          <span className="rounded-full border border-mentor-primary/25 bg-mentor-accent px-2.5 py-0.5 text-[11px] font-bold text-mentor-primary">
            {badge}
          </span>
        )}
      </div>
      <h3 className="mb-2 text-base font-bold text-mentor-text">{title}</h3>
      <p className="text-sm leading-relaxed text-mentor-muted">{description}</p>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   Step Card
──────────────────────────────────────────────────────────── */
function StepCard({ step, index }) {
  const [ref, inView] = useInView(0.2);
  return (
    <div
      ref={ref}
      className={`flex flex-col items-center text-center ${inView ? 'animate-fade-in-up' : 'opacity-0'}`}
      style={{ animationDelay: `${index * 150}ms` }}
    >
      <div className="relative mb-5 flex h-20 w-20 items-center justify-center rounded-3xl border-2 border-mentor-primary/20 bg-mentor-accent text-4xl shadow-[var(--shadow-card)]">
        {step.icon}
        <div className="absolute -top-3 -right-3 flex h-7 w-7 items-center justify-center rounded-full bg-mentor-primary text-xs font-bold text-white shadow-md">
          {index + 1}
        </div>
      </div>
      <h3 className="mb-2 text-lg font-bold text-mentor-text">{step.title}</h3>
      <p className="text-sm leading-relaxed text-mentor-muted px-2">{step.description}</p>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   데이터 상수
──────────────────────────────────────────────────────────── */
const FEATURES = [
  {
    icon: '🎤',
    title: 'AI 맞춤 면접',
    badge: '핵심',
    description: '이력서·자기소개서·채용공고를 AI가 분석해 맥락 있는 질문을 5개 순서대로 생성합니다. 기술·인성·압박·상황 유형을 선택할 수 있습니다.',
  },
  {
    icon: '📊',
    title: '심층 피드백 리포트',
    description: '답변이 끝나면 논리력·전문성·전달력을 점수로 평가합니다. 강점과 개선 포인트를 구체적인 코멘트로 제공합니다.',
  },
  {
    icon: '📘',
    title: 'CS 맞춤 학습',
    description: 'Java·네트워크·운영체제 등 7개 과목을 AI가 생성한 객관식·주관식 문제로 학습합니다. 오답은 자동으로 오답노트에 저장됩니다.',
  },
  {
    icon: '🎯',
    title: '약점 분석 + 추천',
    description: '과목별 정답률을 분석해 가장 취약한 영역을 찾아냅니다. AI가 집중 학습이 필요한 과목과 난이도를 자동으로 추천합니다.',
  },
  {
    icon: '📈',
    title: '성장 대시보드',
    description: '면접 점수 추이, 학습 정답률, 최근 피드백을 한눈에 확인합니다. 이전 세션을 다시 살펴보며 성장 패턴을 파악할 수 있습니다.',
  },
  {
    icon: '📚',
    title: '기술 도서 스토어',
    description: '면접에 필요한 CS·개발 전문 도서를 직접 검색하고 구매할 수 있습니다. 공부와 구매를 한 곳에서 해결하세요.',
  },
];

const STEPS = [
  {
    icon: '📄',
    title: '서류 업로드',
    description: '이력서, 자기소개서, 채용공고를 등록합니다. 없어도 바로 면접을 시작할 수 있습니다.',
  },
  {
    icon: '🎤',
    title: 'AI 면접 시작',
    description: 'AI가 서류를 읽고 5개의 맞춤 질문을 순서대로 제시합니다. 답변을 텍스트로 입력하세요.',
  },
  {
    icon: '📊',
    title: '피드백 확인',
    description: '면접이 끝나면 AI 종합 분석 리포트를 받습니다. 부족한 영역은 CS 학습으로 바로 보완하세요.',
  },
];
