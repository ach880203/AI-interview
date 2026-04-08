import { lazy, Suspense, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import AppLayout from '../components/layout/AppLayout';
import ErrorBoundary from '../components/ErrorBoundary';
import IntroVideo from '../components/IntroVideo';
import ProtectedRoute from '../components/ProtectedRoute';

/**
 * sessionStorage 키 — 이 값이 있으면 인트로를 이미 본 것으로 처리합니다.
 * localStorage 대신 sessionStorage를 사용해 탭을 닫으면 초기화되도록 합니다.
 * (매 세션마다 첫 접속에서만 영상이 재생됩니다.)
 */
const INTRO_SEEN_KEY = 'ai_mentor_intro_seen';

// ── 홈 (즉시 로드 — 최초 진입점) ──────────────────────────────
import HomePage from '../pages/HomePage';

// ── 인증 (즉시 로드 — 로그인/회원가입은 첫 화면에서 바로 필요) ──
import LoginPage from '../pages/auth/LoginPage';
import RegisterPage from '../pages/auth/RegisterPage';

// ── 나머지 페이지 (lazy — 첫 번들 크기 최소화) ─────────────────
const DashboardPage            = lazy(() => import('../pages/DashboardPage'));
const MyPage                   = lazy(() => import('../pages/MyPage'));
const CustomerCenterPage       = lazy(() => import('../pages/CustomerCenterPage'));
const SubscriptionLandingPage  = lazy(() => import('../pages/subscription/SubscriptionLandingPage'));
const SubscriptionCheckoutPage = lazy(() => import('../pages/subscription/SubscriptionCheckoutPage'));
const SubscriptionPaymentPage  = lazy(() => import('../pages/subscription/SubscriptionPaymentPage'));
const SubscriptionPaymentCallbackPage = lazy(() => import('../pages/subscription/SubscriptionPaymentCallbackPage'));
const SubscriptionCompletePage = lazy(() => import('../pages/subscription/SubscriptionCompletePage'));

const ResumePage               = lazy(() => import('../pages/profile/ResumePage'));
const CoverLetterPage          = lazy(() => import('../pages/profile/CoverLetterPage'));
const JobPostingPage           = lazy(() => import('../pages/profile/JobPostingPage'));

const InterviewSetupPage       = lazy(() => import('../pages/interview/InterviewSetupPage'));
const InterviewSessionPage     = lazy(() => import('../pages/interview/InterviewSessionPage'));
const InterviewResultPage      = lazy(() => import('../pages/interview/InterviewResultPage'));
const InterviewHistoryPage     = lazy(() => import('../pages/interview/InterviewHistoryPage'));
const InterviewReviewPage      = lazy(() => import('../pages/interview/InterviewReviewPage'));
const InterviewSessionDetailPage = lazy(() => import('../pages/interview/InterviewSessionDetailPage'));

const LearningPage             = lazy(() => import('../pages/learning/LearningPage'));
const LearningSessionPage      = lazy(() => import('../pages/learning/LearningSessionPage'));
const LearningWeaknessPage     = lazy(() => import('../pages/learning/LearningWeaknessPage'));

const BookStorePage            = lazy(() => import('../pages/bookstore/BookStorePage'));
const CartPage                 = lazy(() => import('../pages/bookstore/CartPage'));
const OrderCheckoutPage        = lazy(() => import('../pages/bookstore/OrderCheckoutPage'));
const OrderPaymentPage         = lazy(() => import('../pages/bookstore/OrderPaymentPage'));
const OrderPaymentCallbackPage = lazy(() => import('../pages/bookstore/OrderPaymentCallbackPage'));
const OrderCompletePage        = lazy(() => import('../pages/bookstore/OrderCompletePage'));
const OrderPage                = lazy(() => import('../pages/bookstore/OrderPage'));

const KakaoCallbackPage        = lazy(() => import('../pages/auth/KakaoCallbackPage'));
const WrongAnswerPage          = lazy(() => import('../pages/WrongAnswerPage'));
const AdminPage                = lazy(() => import('../pages/admin/AdminPage'));

/** 페이지 전환 중 보여주는 로딩 스피너 */
function PageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <span className="h-8 w-8 animate-spin rounded-full border-4 border-mentor-accent border-t-mentor-primary" />
    </div>
  );
}

export default function AppRouter() {
  /**
   * 인트로 영상 표시 여부
   *
   * [초기값 계산]
   * useState의 initializer function은 컴포넌트 최초 마운트 시 단 한 번만 실행됩니다.
   * sessionStorage에 INTRO_SEEN_KEY 값이 없으면 → true(인트로 표시)
   * 값이 있으면 → false(인트로 건너뜀)
   */
  const [showIntro, setShowIntro] = useState(
    () => !sessionStorage.getItem(INTRO_SEEN_KEY)
  );

  /**
   * 홈페이지 첫 진입인지 먼저 확인합니다.
   *
   * 왜 이렇게 했는지:
   * - 인트로 영상은 홈페이지 진입 경험에만 직접 연결됩니다.
   * - 다른 페이지까지 뒤에서 먼저 렌더링하면 영상 재생과 초기 렌더링이 겹쳐
   *   브라우저 메인 스레드가 바빠질 수 있습니다.
   */
  const isHomeEntryPath = window.location.pathname === '/';

  /**
   * 인트로 영상 종료 처리
   * IntroVideo 컴포넌트의 onComplete 콜백으로 전달됩니다.
   * - sessionStorage에 완료 기록 저장 (같은 세션 내 재방문 시 스킵)
   * - showIntro를 false로 변경해 라우팅 화면으로 전환
   */
  function handleIntroComplete() {
    sessionStorage.setItem(INTRO_SEEN_KEY, '1');
    setShowIntro(false);
  }

  /**
   * 인트로 재생 중에는 홈페이지 라우터를 뒤에서 같이 마운트하지 않습니다.
   *
   * 주의:
   * - HomePage는 초기 애니메이션과 관찰자(IntersectionObserver) 설정이 많아서
   *   영상과 동시에 마운트되면 끊김 원인이 될 수 있습니다.
   * - 따라서 "/" 첫 진입일 때만 인트로를 단독으로 먼저 렌더링합니다.
   */
  if (showIntro && isHomeEntryPath) {
    return <IntroVideo onComplete={handleIntroComplete} />;
  }

  return (
    <>
      {/* 인트로가 끝난 뒤 실제 라우터를 마운트합니다. */}
      <BrowserRouter>
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* ── 인증 (비로그인 접근 가능) ────────────────────────── */}
            <Route path="/auth/login" element={<LoginPage />} />
            <Route path="/auth/register" element={<RegisterPage />} />
            <Route path="/auth/kakao/callback" element={<KakaoCallbackPage />} />

            {/* ── 대시보드 ────────────────────────────────────────── */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <AppLayout><DashboardPage /></AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/mypage"
              element={
                <ProtectedRoute>
                  <AppLayout><MyPage /></AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/support"
              element={
                <ProtectedRoute>
                  <AppLayout><CustomerCenterPage /></AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/subscription"
              element={
                <ProtectedRoute>
                  <AppLayout><SubscriptionLandingPage /></AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/subscription/checkout"
              element={
                <ProtectedRoute>
                  <AppLayout><SubscriptionCheckoutPage /></AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/subscription/payment"
              element={
                <ProtectedRoute>
                  <AppLayout><SubscriptionPaymentPage /></AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/subscription/payment/callback/:subscriptionId"
              element={
                <ProtectedRoute>
                  <AppLayout><SubscriptionPaymentCallbackPage /></AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/subscription/complete/:subscriptionId"
              element={
                <ProtectedRoute>
                  <AppLayout><SubscriptionCompletePage /></AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/subscription/complete"
              element={
                <ProtectedRoute>
                  <AppLayout><SubscriptionCompletePage /></AppLayout>
                </ProtectedRoute>
              }
            />

            {/* ── 프로필 ──────────────────────────────────────────── */}
            <Route path="/profile/resume"       element={<ProtectedRoute><AppLayout><ResumePage /></AppLayout></ProtectedRoute>} />
            <Route path="/profile/cover-letter" element={<ProtectedRoute><AppLayout><CoverLetterPage /></AppLayout></ProtectedRoute>} />
            <Route path="/profile/job-posting"  element={<ProtectedRoute><AppLayout><JobPostingPage /></AppLayout></ProtectedRoute>} />

            {/* ── 면접 ────────────────────────────────────────────── */}
            <Route path="/interview/setup"            element={<ProtectedRoute><AppLayout><InterviewSetupPage /></AppLayout></ProtectedRoute>} />
            <Route path="/interview/session/:sessionId" element={<ProtectedRoute><AppLayout><InterviewSessionPage /></AppLayout></ProtectedRoute>} />
            <Route path="/interview/result/:id"       element={<ProtectedRoute><AppLayout><InterviewResultPage /></AppLayout></ProtectedRoute>} />
            <Route path="/interview/history"          element={<ProtectedRoute><AppLayout><InterviewHistoryPage /></AppLayout></ProtectedRoute>} />
            <Route path="/interview/review"           element={<ProtectedRoute><AppLayout><InterviewReviewPage /></AppLayout></ProtectedRoute>} />
            <Route path="/interview/sessions/:id"     element={<ProtectedRoute><AppLayout><InterviewSessionDetailPage /></AppLayout></ProtectedRoute>} />

            {/* ── 학습 ────────────────────────────────────────────── */}
            <Route path="/learning"          element={<ProtectedRoute><AppLayout><LearningPage /></AppLayout></ProtectedRoute>} />
            <Route path="/learning/session"  element={<ProtectedRoute><AppLayout><LearningSessionPage /></AppLayout></ProtectedRoute>} />
            <Route path="/learning/weakness" element={<ProtectedRoute><AppLayout><LearningWeaknessPage /></AppLayout></ProtectedRoute>} />

            {/* ── 오답노트 ─────────────────────────────────────────── */}
            <Route path="/wrong-answers" element={<ProtectedRoute><AppLayout><WrongAnswerPage /></AppLayout></ProtectedRoute>} />

            {/* ── 도서 스토어 ──────────────────────────────────────── */}
            {/* /books: 비로그인도 목록 조회 가능 (BE SecurityConfig과 일치), 구매 시 로그인 필요 */}
            <Route path="/books"            element={<AppLayout><BookStorePage /></AppLayout>} />
            <Route path="/cart"             element={<ProtectedRoute><AppLayout><CartPage /></AppLayout></ProtectedRoute>} />
            <Route path="/orders"           element={<ProtectedRoute><AppLayout><OrderPage /></AppLayout></ProtectedRoute>} />
            <Route path="/orders/checkout"  element={<ProtectedRoute><AppLayout><OrderCheckoutPage /></AppLayout></ProtectedRoute>} />
            <Route path="/orders/payment"   element={<ProtectedRoute><AppLayout><OrderPaymentPage /></AppLayout></ProtectedRoute>} />
            <Route path="/orders/payment/callback/:orderId" element={<ProtectedRoute><AppLayout><OrderPaymentCallbackPage /></AppLayout></ProtectedRoute>} />
            <Route path="/orders/complete/:orderId" element={<ProtectedRoute><AppLayout><OrderCompletePage /></AppLayout></ProtectedRoute>} />

            {/* ── 관리자 (ADMIN 전용) ──────────────────────────────── */}
            <Route path="/admin" element={<ProtectedRoute requireAdmin><AppLayout><AdminPage /></AppLayout></ProtectedRoute>} />

            {/* ── 홈(랜딩) — 비로그인 공개 ─────────────────────────── */}
            <Route path="/" element={<HomePage />} />

            {/* ── 404 → 홈으로 ─────────────────────────────────────── */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </Suspense>
        </ErrorBoundary>
      </BrowserRouter>
    </>
  );
}
