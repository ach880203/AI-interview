import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import AppLayout from '../components/layout/AppLayout';
import ErrorBoundary from '../components/ErrorBoundary';
import ProtectedRoute from '../components/ProtectedRoute';

// ── 홈 (즉시 로드 — 최초 진입점) ──────────────────────────────
import HomePage from '../pages/HomePage';

// ── 인증 (즉시 로드 — 로그인/회원가입은 첫 화면에서 바로 필요) ──
import LoginPage from '../pages/auth/LoginPage';
import RegisterPage from '../pages/auth/RegisterPage';

// ── 나머지 페이지 (lazy — 첫 번들 크기 최소화) ─────────────────
const DashboardPage            = lazy(() => import('../pages/DashboardPage'));
const MyPage                   = lazy(() => import('../pages/MyPage'));
const SubscriptionPage         = lazy(() => import('../pages/SubscriptionPage'));

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
const OrderPage                = lazy(() => import('../pages/bookstore/OrderPage'));

const WrongAnswerPage          = lazy(() => import('../pages/WrongAnswerPage'));
const AdminPage                = lazy(() => import('../pages/admin/AdminPage'));

/** 페이지 전환 중 보여주는 로딩 스피너 */
function PageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <span className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
    </div>
  );
}

export default function AppRouter() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* ── 인증 (비로그인 접근 가능) ────────────────────────── */}
            <Route path="/auth/login" element={<LoginPage />} />
            <Route path="/auth/register" element={<RegisterPage />} />

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
              path="/subscription"
              element={
                <ProtectedRoute>
                  <AppLayout><SubscriptionPage /></AppLayout>
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
            <Route path="/books"  element={<AppLayout><BookStorePage /></AppLayout>} />
            <Route path="/cart"   element={<ProtectedRoute><AppLayout><CartPage /></AppLayout></ProtectedRoute>} />
            <Route path="/orders" element={<ProtectedRoute><AppLayout><OrderPage /></AppLayout></ProtectedRoute>} />

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
  );
}
