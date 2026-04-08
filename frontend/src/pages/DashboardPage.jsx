import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ResponsiveGridLayout as RGLResponsive } from 'react-grid-layout';
// react-grid-layout, react-resizable CSS: 위젯 절대 좌표 배치·리사이즈 핸들에 필수.
// 이 두 줄이 없으면 모든 위젯이 세로로 쌓이고 크기·위치 지정이 전혀 작동하지 않습니다.
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import {
  BarChart, Bar,
  LineChart, Line,
  PieChart, Pie, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import * as interviewApi from '../api/interview';
import * as learningApi from '../api/learning';
import * as profileApi from '../api/profile';
import * as subscriptionApi from '../api/subscription';
import useAuthStore from '../store/authStore';
import MemoWidget from '../components/common/MemoWidget';
import TodoWidget from '../components/common/TodoWidget';
import DailyPracticeWidget from '../components/interview/DailyPracticeWidget';

const ResponsiveGridLayout = RGLResponsive;

/** localStorage에 위젯 레이아웃을 저장하는 키 */
const LAYOUT_STORAGE_KEY = 'dashboard-widget-layout';

/** localStorage에 숨긴 위젯 ID 목록을 저장하는 키 */
const HIDDEN_WIDGET_STORAGE_KEY = 'dashboard-hidden-widgets';

/**
 * localStorage에 위젯을 숨기기 직전 위치 스냅샷을 저장하는 키
 * 나중에 위젯을 다시 추가할 때 이전 위치로 복원하는 데 사용합니다.
 */
const LAST_LAYOUT_SNAPSHOT_KEY = 'dashboard-last-widget-layout';

function buildDashboardStorageKey(baseKey, userStorageKey = 'anonymous') {
  return `${baseKey}:${userStorageKey}`;
}

/** Recharts 차트에 사용하는 색상 팔레트 */
const CHART_COLORS = ['#6366f1', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#a78bfa'];

/**
 * 위젯 레지스트리 — 대시보드에 존재하는 모든 위젯의 정보를 한 곳에서 관리합니다.
 *
 * [removable]
 * false  → '통계 요약'처럼 핵심 정보를 담아 숨기기를 막아야 할 위젯
 * true   → 사용자가 숨겼다가 다시 추가할 수 있는 위젯
 *
 * 이 배열 순서가 "위젯 추가" 드롭다운의 표시 순서가 됩니다.
 */
const DASHBOARD_WIDGETS = [
  { id: 'stats',           title: '통계 요약',        removable: false },
  { id: 'dday',            title: 'D-Day',             removable: true },
  { id: 'subscription',    title: '구독 상태',          removable: true },
  { id: 'feedback',        title: '최근 면접 결과',    removable: true },
  { id: 'recommendation',  title: 'AI 학습 추천',      removable: true },
  { id: 'score-trend',     title: '면접 점수 추이',    removable: true },
  { id: 'radar',           title: '면접 역량 분석',    removable: true },
  { id: 'accuracy-trend',  title: '과목별 학습 정확도', removable: true },
  { id: 'mastery',         title: '과목 마스터리',      removable: true },
  { id: 'sessions',        title: '최근 면접 기록',    removable: true },
  { id: 'wrong-notes',     title: '오답 노트',          removable: true },
  { id: 'weakness',        title: '학습 약점 요약',    removable: true },
  { id: 'activity',        title: '학습 활동',          removable: true },
  { id: 'memo',            title: '메모장',             removable: true },
  { id: 'todo',            title: 'TO-DO 리스트',       removable: true },
  { id: 'daily-practice',  title: '오늘의 연습질문',    removable: true },
];

/**
 * 기본 위젯 레이아웃
 * w: 너비(컬럼 기준), h: 높이(행 단위, rowHeight=60px)
 */
const DEFAULT_LAYOUTS = {
  lg: [
    { i: 'stats',          x: 0, y: 0,  w: 12, h: 3, minW: 6, minH: 2 },
    { i: 'dday',           x: 0, y: 3,  w: 7,  h: 4, minW: 4, minH: 3 },
    { i: 'subscription',   x: 7, y: 3,  w: 5,  h: 4, minW: 3, minH: 2 },
    { i: 'feedback',       x: 0, y: 7,  w: 7,  h: 4, minW: 6, minH: 3 },
    { i: 'recommendation', x: 7, y: 7,  w: 5,  h: 4, minW: 3, minH: 3 },
    { i: 'score-trend',    x: 0, y: 11, w: 7,  h: 5, minW: 5, minH: 4 },
    { i: 'radar',          x: 7, y: 11, w: 5,  h: 5, minW: 4, minH: 4 },
    { i: 'accuracy-trend', x: 0, y: 16, w: 7,  h: 5, minW: 4, minH: 4 },
    { i: 'mastery',        x: 7, y: 16, w: 5,  h: 5, minW: 4, minH: 4 },
    { i: 'sessions',       x: 0, y: 21, w: 7,  h: 6, minW: 4, minH: 4 },
    { i: 'wrong-notes',    x: 7, y: 21, w: 5,  h: 6, minW: 4, minH: 3 },
    { i: 'weakness',       x: 0, y: 27, w: 7,  h: 6, minW: 3, minH: 3 },
    { i: 'activity',       x: 7, y: 27, w: 5,  h: 5, minW: 5, minH: 3 },
    { i: 'memo',           x: 0, y: 33, w: 5,  h: 5, minW: 3, minH: 3 },
    { i: 'todo',           x: 5, y: 33, w: 7,  h: 5, minW: 3, minH: 3 },
    { i: 'daily-practice', x: 0, y: 38, w: 12, h: 5, minW: 4, minH: 4 },
  ],
  md: [
    { i: 'stats',          x: 0, y: 0,  w: 10, h: 3 },
    { i: 'dday',           x: 0, y: 3,  w: 6,  h: 4 },
    { i: 'subscription',   x: 6, y: 3,  w: 4,  h: 4 },
    { i: 'feedback',       x: 0, y: 7,  w: 6,  h: 4 },
    { i: 'recommendation', x: 6, y: 7,  w: 4,  h: 4 },
    { i: 'score-trend',    x: 0, y: 11, w: 6,  h: 5 },
    { i: 'radar',          x: 6, y: 11, w: 4,  h: 5 },
    { i: 'accuracy-trend', x: 0, y: 16, w: 6,  h: 5 },
    { i: 'mastery',        x: 6, y: 16, w: 4,  h: 5 },
    { i: 'sessions',       x: 0, y: 21, w: 6,  h: 6 },
    { i: 'wrong-notes',    x: 6, y: 21, w: 4,  h: 6 },
    { i: 'weakness',       x: 0, y: 27, w: 6,  h: 6 },
    { i: 'activity',       x: 6, y: 27, w: 4,  h: 5 },
    { i: 'memo',           x: 0, y: 33, w: 5,  h: 5 },
    { i: 'todo',           x: 5, y: 33, w: 5,  h: 5 },
    { i: 'daily-practice', x: 0, y: 38, w: 10, h: 5 },
  ],
  sm: [
    { i: 'stats',          x: 0, y: 0,  w: 6, h: 3 },
    { i: 'dday',           x: 0, y: 3,  w: 6, h: 4 },
    { i: 'subscription',   x: 0, y: 7,  w: 6, h: 4 },
    { i: 'feedback',       x: 0, y: 11, w: 6, h: 4 },
    { i: 'recommendation', x: 0, y: 15, w: 6, h: 4 },
    { i: 'score-trend',    x: 0, y: 19, w: 6, h: 5 },
    { i: 'radar',          x: 0, y: 24, w: 6, h: 5 },
    { i: 'accuracy-trend', x: 0, y: 29, w: 6, h: 5 },
    { i: 'mastery',        x: 0, y: 34, w: 6, h: 5 },
    { i: 'sessions',       x: 0, y: 39, w: 6, h: 6 },
    { i: 'wrong-notes',    x: 0, y: 45, w: 6, h: 6 },
    { i: 'weakness',       x: 0, y: 51, w: 6, h: 6 },
    { i: 'activity',       x: 0, y: 57, w: 6, h: 5 },
    { i: 'memo',           x: 0, y: 62, w: 6, h: 5 },
    { i: 'todo',           x: 0, y: 67, w: 6, h: 5 },
    { i: 'daily-practice', x: 0, y: 72, w: 6, h: 6 },
  ],
};

/**
 * localStorage에서 저장된 레이아웃을 불러옵니다.
 * 없으면 기본 레이아웃을 사용합니다.
 *
 * [마이그레이션]
 * 기존 사용자의 저장 레이아웃에 신규 위젯이 없으면,
 * DEFAULT_LAYOUTS의 해당 위젯 위치를 자동으로 추가합니다.
 */
function loadSavedLayouts(userStorageKey) {
  try {
    const saved = localStorage.getItem(buildDashboardStorageKey(LAYOUT_STORAGE_KEY, userStorageKey));
    if (!saved) return DEFAULT_LAYOUTS;

    const parsed = JSON.parse(saved);
    const allowedWidgetIds = new Set(DASHBOARD_WIDGETS.map((widget) => widget.id));
    const result = {};
    for (const bp of ['lg', 'md', 'sm']) {
      const cleanedLayout = (parsed[bp] || []).filter((item) => allowedWidgetIds.has(item.i));
      const existingIds = new Set(cleanedLayout.map((item) => item.i));
      const missingItems = (DEFAULT_LAYOUTS[bp] || []).filter((item) => !existingIds.has(item.i));
      result[bp] = [...cleanedLayout, ...missingItems];
    }
    return result;
  } catch {
    return DEFAULT_LAYOUTS;
  }
}

/**
 * localStorage에서 숨긴 위젯 ID 목록을 불러옵니다.
 * 없으면 빈 배열을 반환합니다.
 */
function loadHiddenWidgetIds(userStorageKey) {
  try {
    const saved = localStorage.getItem(buildDashboardStorageKey(HIDDEN_WIDGET_STORAGE_KEY, userStorageKey));
    const allowedWidgetIds = new Set(DASHBOARD_WIDGETS.map((widget) => widget.id));
    return saved ? JSON.parse(saved).filter((widgetId) => allowedWidgetIds.has(widgetId)) : [];
  } catch {
    return [];
  }
}

/**
 * localStorage에서 숨기기 직전 위치 스냅샷을 불러옵니다.
 * 없으면 빈 객체를 반환합니다.
 */
function loadLastWidgetLayouts(userStorageKey) {
  try {
    const saved = localStorage.getItem(buildDashboardStorageKey(LAST_LAYOUT_SNAPSHOT_KEY, userStorageKey));
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

/**
 * 학습 분석 응답의 과목 이름 필드를 화면에서 일관되게 사용하도록 정규화합니다.
 */
function normalizeAnalyticsCategories(categories = []) {
  return categories.map((category, index) => ({
    ...category,
    name: category.name ?? category.subjectName ?? `과목 ${index + 1}`,
  }));
}

/**
 * 숫자 카운트업 훅 — 0에서 목표값까지 1초간 부드럽게 증가합니다.
 */
function useCountUp(target, duration = 1000) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (typeof target !== 'number' || isNaN(target)) return;
    let frame = 0;
    const totalFrames = Math.round(duration / 16);
    const easeOut = (t) => 1 - Math.pow(1 - t, 3);
    const timer = setInterval(() => {
      frame++;
      setCount(Math.round(easeOut(frame / totalFrames) * target));
      if (frame >= totalFrames) clearInterval(timer);
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration]);
  return count;
}

/**
 * 대시보드 페이지 — 위젯 기반 레이아웃
 */
export default function DashboardPage() {
  const user = useAuthStore((state) => state.user);
  const userStorageKey = user?.email ?? 'anonymous';

  const [dashboardData, setDashboardData] = useState({
    resumes: [],
    coverLetters: [],
    jobPostings: [],
    sessions: [],
    learningStats: {
      totalAttempts: 0,
      correctAttempts: 0,
      accuracyRate: 0,
      subjectStats: [],
      recentAttempts: [],
    },
    analyticsCategories: [],
    recommendation: null,
    subscription: null,
    wrongAttempts: [],
    allFeedbacks: [],
  });
  const [recentFeedback, setRecentFeedback] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let shouldIgnore = false;

    async function fetchDashboardData() {
      setLoading(true);
      setError('');

      const [
        resumeResult,
        coverLetterResult,
        jobPostingResult,
        sessionResult,
        learningStatsResult,
        analyticsResult,
        recommendationResult,
        subscriptionResult,
        wrongAttemptsResult,
        growthReportResult,
      ] = await Promise.allSettled([
        profileApi.getResumes(),
        profileApi.getCoverLetters(),
        profileApi.getJobPostings(),
        interviewApi.getSessions(),
        learningApi.getStats(),
        learningApi.getAnalytics(),
        learningApi.getRecommendation(),
        subscriptionApi.getMySubscription(),
        learningApi.getWrongAttempts(),
        interviewApi.getGrowthReport(),
      ]);

      const sessions = sessionResult.status === 'fulfilled'
        ? sessionResult.value.data.data ?? []
        : [];

      const nextData = {
        resumes: resumeResult.status === 'fulfilled' ? resumeResult.value.data.data ?? [] : [],
        coverLetters: coverLetterResult.status === 'fulfilled' ? coverLetterResult.value.data.data ?? [] : [],
        jobPostings: jobPostingResult.status === 'fulfilled' ? jobPostingResult.value.data.data ?? [] : [],
        sessions,
        learningStats:
          learningStatsResult.status === 'fulfilled'
            ? learningStatsResult.value.data.data ?? {
                totalAttempts: 0, correctAttempts: 0, accuracyRate: 0, subjectStats: [], recentAttempts: [],
              }
            : { totalAttempts: 0, correctAttempts: 0, accuracyRate: 0, subjectStats: [], recentAttempts: [] },
        analyticsCategories:
          analyticsResult.status === 'fulfilled'
            ? normalizeAnalyticsCategories(analyticsResult.value.data.data?.categories ?? [])
            : [],
        recommendation:
          recommendationResult.status === 'fulfilled'
            ? recommendationResult.value.data.data ?? null
            : null,
        subscription:
          subscriptionResult.status === 'fulfilled'
            ? subscriptionResult.value.data.data ?? null
            : null,
        wrongAttempts:
          wrongAttemptsResult.status === 'fulfilled'
            ? wrongAttemptsResult.value.data.data ?? []
            : [],
        allFeedbacks: buildAllFeedbacks(growthReportResult),
      };

      if (shouldIgnore) return;
      setDashboardData(nextData);

      /**
       * 목록 응답에 feedbackReady를 함께 내려받아
       * 피드백이 아직 저장되지 않은 COMPLETED 세션으로 404를 만들지 않도록 막습니다.
       */
      const latestCompleted = sessions.find(
        (session) => session.status === 'COMPLETED' && session.feedbackReady
      );
      if (latestCompleted) {
        try {
          const feedbackResult = await interviewApi.getFeedback(latestCompleted.id);
          if (shouldIgnore) return;
          setRecentFeedback({ ...feedbackResult.data.data, sessionId: latestCompleted.id });
        } catch {
          if (shouldIgnore) return;
          setRecentFeedback(null);
        }
      } else {
        setRecentFeedback(null);
      }

      const allFailed = [
        resumeResult, coverLetterResult, jobPostingResult,
        sessionResult, learningStatsResult, analyticsResult,
      ].every((result) => result.status === 'rejected');

      if (allFailed) {
        setError('대시보드 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
      }

      if (shouldIgnore) return;
      setLoading(false);
    }

    fetchDashboardData();

    return () => {
      shouldIgnore = true;
    };
  }, []);

  const [layouts, setLayouts] = useState(() => loadSavedLayouts(userStorageKey));
  const [editMode, setEditMode] = useState(false);
  const [hiddenWidgetIds, setHiddenWidgetIds] = useState(() => loadHiddenWidgetIds(userStorageKey));
  const [lastWidgetLayouts, setLastWidgetLayouts] = useState(() => loadLastWidgetLayouts(userStorageKey));
  const [showWidgetSelector, setShowWidgetSelector] = useState(false);

  useEffect(() => {
    // 대시보드 위젯 배치는 사용자 취향이 크게 갈리므로 계정별로 분리 저장합니다.
    setLayouts(loadSavedLayouts(userStorageKey));
    setHiddenWidgetIds(loadHiddenWidgetIds(userStorageKey));
    setLastWidgetLayouts(loadLastWidgetLayouts(userStorageKey));
    setShowWidgetSelector(false);
    setEditMode(false);
  }, []);

  const gridContainerRef = useRef(null);
  const [gridWidth, setGridWidth] = useState(1200);

  useEffect(() => {
    const el = gridContainerRef.current;
    if (!el) return;
    setGridWidth(el.getBoundingClientRect().width);
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setGridWidth(entry.contentRect.width);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [userStorageKey]);

  /**
   * 편집 모드가 아닐 때 모든 위젯을 static: true로 잠급니다.
   * react-grid-layout v2에서 isDraggable={false}만으로는 드래그가 완전히 차단되지 않는
   * 알려진 이슈가 있어, static 플래그로 확실하게 잠금합니다.
   */
  const effectiveLayouts = useMemo(() => {
    if (editMode) return layouts;
    const locked = {};
    for (const bp of Object.keys(layouts)) {
      locked[bp] = (layouts[bp] || []).map((item) => ({ ...item, static: true }));
    }
    return locked;
  }, [layouts, editMode]);

  const handleLayoutChange = useCallback((_current, allLayouts) => {
    // static 플래그를 제거한 원본만 저장 (편집 모드 진입 시 다시 풀어야 하므로)
    const cleaned = {};
    for (const bp of Object.keys(allLayouts)) {
      cleaned[bp] = (allLayouts[bp] || []).map((item) => {
        const nextItem = { ...item };
        delete nextItem.static;
        return nextItem;
      });
    }
    setLayouts(cleaned);
    try {
      localStorage.setItem(buildDashboardStorageKey(LAYOUT_STORAGE_KEY, userStorageKey), JSON.stringify(cleaned));
    } catch {
      // localStorage 용량 초과 시 무시
    }
  }, [userStorageKey]);

  function handleHideAll() {
    const removableIds = DASHBOARD_WIDGETS.filter((w) => w.removable).map((w) => w.id);
    removableIds.forEach((id) => handleHideWidget(id));
  }

  function handleResetLayout() {
    setLayouts(DEFAULT_LAYOUTS);
    setHiddenWidgetIds([]);
    setLastWidgetLayouts({});
    setShowWidgetSelector(false);
    localStorage.removeItem(buildDashboardStorageKey(LAYOUT_STORAGE_KEY, userStorageKey));
    localStorage.removeItem(buildDashboardStorageKey(HIDDEN_WIDGET_STORAGE_KEY, userStorageKey));
    localStorage.removeItem(buildDashboardStorageKey(LAST_LAYOUT_SNAPSHOT_KEY, userStorageKey));
  }

  const handleHideWidget = useCallback((widgetId) => {
    setLastWidgetLayouts((prev) => {
      const snapshot = {};
      ['lg', 'md', 'sm'].forEach((bp) => {
        const item = layouts[bp]?.find((l) => l.i === widgetId);
        if (item) snapshot[bp] = { x: item.x, y: item.y, w: item.w, h: item.h };
      });
      const next = { ...prev, [widgetId]: snapshot };
      try {
        localStorage.setItem(buildDashboardStorageKey(LAST_LAYOUT_SNAPSHOT_KEY, userStorageKey), JSON.stringify(next));
      } catch {
        /* 저장 실패는 화면 동작보다 중요하지 않아 무시합니다. */
      }
      return next;
    });

    setLayouts((prev) => {
      const next = {};
      ['lg', 'md', 'sm'].forEach((bp) => {
        next[bp] = (prev[bp] || []).filter((l) => l.i !== widgetId);
      });
      try {
        localStorage.setItem(buildDashboardStorageKey(LAYOUT_STORAGE_KEY, userStorageKey), JSON.stringify(next));
      } catch {
        /* 저장 실패는 화면 동작보다 중요하지 않아 무시합니다. */
      }
      return next;
    });

    setHiddenWidgetIds((prev) => {
      const next = [...prev, widgetId];
      try {
        localStorage.setItem(buildDashboardStorageKey(HIDDEN_WIDGET_STORAGE_KEY, userStorageKey), JSON.stringify(next));
      } catch {
        /* 저장 실패는 화면 동작보다 중요하지 않아 무시합니다. */
      }
      return next;
    });
  }, [layouts, userStorageKey]);

  const handleRestoreWidget = useCallback((widgetId) => {
    setLayouts((prev) => {
      const next = {};
      ['lg', 'md', 'sm'].forEach((bp) => {
        const existingItems = prev[bp] || [];
        const savedPos = lastWidgetLayouts[widgetId]?.[bp];
        const defaultItem = DEFAULT_LAYOUTS[bp]?.find((l) => l.i === widgetId);

        let newItem;
        if (savedPos) {
          newItem = {
            i: widgetId,
            ...savedPos,
            ...(defaultItem?.minW != null ? { minW: defaultItem.minW } : {}),
            ...(defaultItem?.minH != null ? { minH: defaultItem.minH } : {}),
          };
        } else {
          const maxY = existingItems.reduce((acc, item) => Math.max(acc, item.y + item.h), 0);
          newItem = {
            i: widgetId,
            x: 0,
            y: maxY,
            w: defaultItem?.w ?? 6,
            h: defaultItem?.h ?? 4,
            ...(defaultItem?.minW != null ? { minW: defaultItem.minW } : {}),
            ...(defaultItem?.minH != null ? { minH: defaultItem.minH } : {}),
          };
        }
        next[bp] = [...existingItems, newItem];
      });
      try {
        localStorage.setItem(buildDashboardStorageKey(LAYOUT_STORAGE_KEY, userStorageKey), JSON.stringify(next));
      } catch {
        /* 저장 실패는 화면 동작보다 중요하지 않아 무시합니다. */
      }
      return next;
    });

    setHiddenWidgetIds((prev) => {
      const next = prev.filter((id) => id !== widgetId);
      try {
        localStorage.setItem(buildDashboardStorageKey(HIDDEN_WIDGET_STORAGE_KEY, userStorageKey), JSON.stringify(next));
      } catch {
        /* 저장 실패는 화면 동작보다 중요하지 않아 무시합니다. */
      }
      return next;
    });

    setShowWidgetSelector(false);
  }, [lastWidgetLayouts, userStorageKey]);

  // ── 파생 데이터 ──────────────────────────────────────────────
  const totalDocuments =
    dashboardData.resumes.length +
    dashboardData.coverLetters.length +
    dashboardData.jobPostings.length;
  const completedSessions = dashboardData.sessions.filter(
    (session) => session.status === 'COMPLETED'
  ).length;
  const recentSessions = dashboardData.sessions.slice(0, 4);
  const recentAttempts = dashboardData.learningStats.recentAttempts ?? [];
  const showRecentLearningWidget = false;
  const weakCategories = [...dashboardData.analyticsCategories]
    .sort((left, right) => {
      if (left.isWeak !== right.isWeak) return left.isWeak ? -1 : 1;
      return (left.accuracy ?? 0) - (right.accuracy ?? 0);
    })
    .slice(0, 4);

  return (
    <div className="min-h-screen bg-mentor-bg px-4 py-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">

        {/* ── 히어로 배너 ── */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="overflow-hidden rounded-[32px] bg-gradient-to-br from-white via-mentor-sky-light to-mentor-warm border border-mentor-border shadow-[var(--shadow-card)]"
        >
          <div className="grid gap-6 px-7 py-8 lg:grid-cols-[minmax(0,1.3fr)_320px]">
            <div>
              <p className="text-sm font-semibold text-mentor-primary">오늘의 준비 현황</p>
              <h1 className="mt-3 text-3xl font-bold leading-tight text-mentor-text">
                {user?.name ? (
                  <>
                    <span className="text-mentor-primary">{user.name}님</span>의 준비 흐름을 한눈에 확인해 보세요.
                  </>
                ) : (
                  '오늘의 준비 흐름을 한눈에 확인해 보세요.'
                )}
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-mentor-muted">
                문서 준비 상태를 먼저 확인하고, 최근 면접 결과와 학습 약점까지 바로 이어서 점검할 수 있도록 구성했습니다.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  to="/interview/setup"
                  className="rounded-full bg-mentor-primary px-6 py-3 text-sm font-semibold text-white transition hover:bg-mentor-primary-dark"
                >
                  면접 시작하기
                </Link>
                <Link
                  to="/learning"
                  className="rounded-full border border-mentor-border bg-white px-6 py-3 text-sm font-semibold text-mentor-text transition hover:border-mentor-primary hover:text-mentor-primary"
                >
                  학습 이어가기
                </Link>
                <Link
                  to="/subscription"
                  className="flex items-center rounded-full px-2 py-3 text-sm text-mentor-muted underline underline-offset-2 transition hover:text-mentor-primary"
                >
                  구독 요금 보기
                </Link>
              </div>
            </div>

            <div className="rounded-3xl bg-white/70 p-5 border border-mentor-border backdrop-blur-sm">
              <p className="text-sm font-semibold text-mentor-text">문서 준비 현황</p>
              <div className="mt-5 grid grid-cols-3 gap-3">
                <MiniCount label="이력서" value={dashboardData.resumes.length} to="/profile/resume" />
                <MiniCount label="자소서" value={dashboardData.coverLetters.length} to="/profile/cover-letter" />
                <MiniCount label="공고" value={dashboardData.jobPostings.length} to="/profile/job-posting" />
              </div>
              <p className="mt-5 text-xs leading-5 text-mentor-muted">
                각 칸을 누르면 해당 문서 관리 페이지로 이동합니다.
              </p>
            </div>
          </div>
        </motion.section>

        {error && (
          <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-mentor-danger border border-red-200">{error}</div>
        )}

        {/* ── AWS 콘솔형 위젯 커스터마이즈 툴바 ── */}
        <div className="flex items-center justify-end gap-2">
          {editMode && (
            <>
              {hiddenWidgetIds.length > 0 && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowWidgetSelector((prev) => !prev)}
                    className="flex items-center gap-1.5 rounded-full border border-mentor-primary bg-mentor-accent px-4 py-2 text-xs font-semibold text-mentor-primary transition hover:bg-mentor-primary/10"
                  >
                    위젯 추가
                    <span className="rounded-full bg-mentor-primary px-1.5 py-0.5 text-xs font-bold text-white">
                      {hiddenWidgetIds.length}
                    </span>
                  </button>

                  {showWidgetSelector && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setShowWidgetSelector(false)}
                      />
                      <div className="absolute right-0 top-full z-50 mt-2 min-w-[180px] overflow-hidden rounded-2xl border border-mentor-border bg-white shadow-lg">
                        <p className="border-b border-mentor-border px-4 py-2.5 text-xs font-semibold text-mentor-muted">
                          숨긴 위젯
                        </p>
                        {hiddenWidgetIds.map((widgetId) => {
                          const widget = DASHBOARD_WIDGETS.find((w) => w.id === widgetId);
                          if (!widget) return null;
                          return (
                            <button
                              key={widgetId}
                              type="button"
                              onClick={() => handleRestoreWidget(widgetId)}
                              className="w-full px-4 py-2.5 text-left text-sm font-semibold text-mentor-text transition hover:bg-mentor-accent"
                            >
                              {widget.title}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={handleResetLayout}
                className="rounded-full border border-mentor-border bg-mentor-bg px-4 py-2 text-xs font-semibold text-mentor-muted transition hover:bg-mentor-border hover:text-mentor-text"
              >
                기본 배치로 초기화
              </button>

              <button
                type="button"
                onClick={handleHideAll}
                className="rounded-full border border-red-200 bg-red-50 px-4 py-2 text-xs font-semibold text-mentor-danger transition hover:bg-red-100"
              >
                위젯 모두 없애기
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => { setEditMode((prev) => !prev); setShowWidgetSelector(false); }}
            className={`rounded-full px-5 py-2 text-xs font-semibold transition ${
              editMode
                ? 'bg-mentor-primary text-white hover:bg-mentor-primary-dark'
                : 'border border-mentor-border bg-mentor-bg text-mentor-muted hover:bg-mentor-border hover:text-mentor-text'
            }`}
          >
            {editMode ? '편집 완료' : '위젯 배치 편집'}
          </button>
        </div>

        {/* ── 드래그·리사이즈 가능한 위젯 그리드 ── */}
        <div
          ref={gridContainerRef}
          className={`relative rounded-3xl transition-all ${
            editMode
              ? 'bg-[repeating-linear-gradient(90deg,transparent,transparent_calc((100%_-_176px)_/_12_-_2px),rgba(var(--color-mentor-primary-rgb,99,130,255),0.07)_calc((100%_-_176px)_/_12_-_2px),rgba(var(--color-mentor-primary-rgb,99,130,255),0.07)_calc((100%_-_176px)_/_12))] outline-dashed outline-1 outline-mentor-primary/20'
              : ''
          }`}
        >
          {hiddenWidgetIds.length === DASHBOARD_WIDGETS.length && (
            <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-mentor-primary/30 bg-white px-8 py-20 text-center">
              <p className="text-4xl">📊</p>
              <p className="mt-4 text-base font-semibold text-mentor-text">표시할 위젯이 없습니다</p>
              <p className="mt-2 text-sm text-mentor-muted">
                편집 모드에서 위젯 추가 버튼을 누르거나, 아래 버튼으로 기본 배치를 복원하세요.
              </p>
              <button
                type="button"
                onClick={handleResetLayout}
                className="mt-6 rounded-full bg-mentor-primary px-6 py-3 text-sm font-semibold text-white transition hover:bg-mentor-primary-dark"
              >
                기본 위젯 전체 복원
              </button>
            </div>
          )}

          <ResponsiveGridLayout
            className="layout"
            layouts={effectiveLayouts}
            breakpoints={{ lg: 1200, md: 996, sm: 0 }}
            cols={{ lg: 12, md: 10, sm: 6 }}
            rowHeight={60}
            margin={[16, 16]}
            containerPadding={[0, 0]}
            width={gridWidth}
            compactType="vertical"
            onLayoutChange={handleLayoutChange}
            draggableHandle={editMode ? '.widget-drag-handle' : '.no-drag-disabled'}
            isResizable={editMode}
            isDraggable={editMode}
          >
            {/* 통계 카드 위젯 */}
            {!hiddenWidgetIds.includes('stats') && (
              <div key="stats">
                <DraggableWidgetWrapper editMode={editMode} title="통계 요약" removable={false}>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    {[
                      { emoji: '📄', title: '등록 문서', value: loading ? null : totalDocuments, description: '면접에 활용하는 전체 준비 문서 수' },
                      { emoji: '🎤', title: '전체 면접 기록', value: loading ? null : dashboardData.sessions.length, description: '누적 면접 세션 수' },
                      { emoji: '✅', title: '완료한 면접', value: loading ? null : completedSessions, description: '피드백 생성까지 끝난 면접 수' },
                      { emoji: '📊', title: '학습 정확도', value: loading ? null : dashboardData.learningStats.accuracyRate, suffix: '%', description: '누적 학습 정답률' },
                    ].map((card) => (
                      <StatCard key={card.title} {...card} />
                    ))}
                  </div>
                </DraggableWidgetWrapper>
              </div>
            )}

            {/* D-Day 위젯 */}
            {!hiddenWidgetIds.includes('dday') && (
              <div key="dday">
                <DraggableWidgetWrapper
                  editMode={editMode}
                  title="D-Day"
                  removable
                  onHide={() => handleHideWidget('dday')}
                >
                  <DDayWidget jobPostings={dashboardData.jobPostings} loading={loading} />
                </DraggableWidgetWrapper>
              </div>
            )}

            {/* 구독 상태 위젯 */}
            {!hiddenWidgetIds.includes('subscription') && (
              <div key="subscription">
                <DraggableWidgetWrapper
                  editMode={editMode}
                  title="구독 상태"
                  removable
                  onHide={() => handleHideWidget('subscription')}
                >
                  <SubscriptionWidget subscription={dashboardData.subscription} loading={loading} />
                </DraggableWidgetWrapper>
              </div>
            )}

            {/* 최근 면접 결과 위젯 */}
            {!hiddenWidgetIds.includes('feedback') && (
              <div key="feedback">
                <DraggableWidgetWrapper
                  editMode={editMode}
                  title="최근 면접 결과"
                  removable
                  onHide={() => handleHideWidget('feedback')}
                >
                  {!loading && recentFeedback ? (
                    <RecentFeedbackWidget feedback={recentFeedback} />
                  ) : (
                    <EmptyPanel title="최근 면접 결과 없음" description="면접을 완료하면 결과가 표시됩니다." compact />
                  )}
                </DraggableWidgetWrapper>
              </div>
            )}

            {/* AI 학습 추천 위젯 */}
            {!hiddenWidgetIds.includes('recommendation') && (
              <div key="recommendation">
                <DraggableWidgetWrapper
                  editMode={editMode}
                  title="AI 학습 추천"
                  removable
                  onHide={() => handleHideWidget('recommendation')}
                >
                  <RecommendationWidget recommendation={dashboardData.recommendation} loading={loading} />
                </DraggableWidgetWrapper>
              </div>
            )}

            {/* 면접 점수 추이 차트 위젯 */}
            {!hiddenWidgetIds.includes('score-trend') && (
              <div key="score-trend">
                <DraggableWidgetWrapper
                  editMode={editMode}
                  title="면접 점수 추이"
                  removable
                  onHide={() => handleHideWidget('score-trend')}
                >
                  <ScoreTrendWidget allFeedbacks={dashboardData.allFeedbacks} loading={loading} />
                </DraggableWidgetWrapper>
              </div>
            )}

            {/* 면접 역량 레이더 차트 위젯 */}
            {!hiddenWidgetIds.includes('radar') && (
              <div key="radar">
                <DraggableWidgetWrapper
                  editMode={editMode}
                  title="면접 역량 분석"
                  removable
                  onHide={() => handleHideWidget('radar')}
                >
                  <RadarWidget allFeedbacks={dashboardData.allFeedbacks} loading={loading} />
                </DraggableWidgetWrapper>
              </div>
            )}

            {/* 과목별 학습 정확도 바 차트 위젯 */}
            {!hiddenWidgetIds.includes('accuracy-trend') && (
              <div key="accuracy-trend">
                <DraggableWidgetWrapper
                  editMode={editMode}
                  title="과목별 학습 정확도"
                  removable
                  onHide={() => handleHideWidget('accuracy-trend')}
                >
                  <AccuracyBarWidget categories={dashboardData.analyticsCategories} loading={loading} />
                </DraggableWidgetWrapper>
              </div>
            )}

            {/* 과목 마스터리 파이 차트 위젯 */}
            {!hiddenWidgetIds.includes('mastery') && (
              <div key="mastery">
                <DraggableWidgetWrapper
                  editMode={editMode}
                  title="과목 마스터리"
                  removable
                  onHide={() => handleHideWidget('mastery')}
                >
                  <MasteryPieWidget categories={dashboardData.analyticsCategories} loading={loading} />
                </DraggableWidgetWrapper>
              </div>
            )}

            {/* 최근 면접 기록 위젯 */}
            {!hiddenWidgetIds.includes('sessions') && (
              <div key="sessions">
                <DraggableWidgetWrapper
                  editMode={editMode}
                  title="최근 면접 기록"
                  removable
                  onHide={() => handleHideWidget('sessions')}
                >
                  <WidgetCard title="최근 면접 기록" subtitle="가장 최근에 진행한 면접 흐름을 다시 확인합니다." linkTo="/interview/history" linkLabel="전체 이력 보기">
                    {loading ? (
                      <LoadingBlock />
                    ) : recentSessions.length === 0 ? (
                      <EmptyPanel title="면접 기록이 아직 없습니다." description="첫 면접을 시작하면 이 영역에 최근 기록이 표시됩니다." />
                    ) : (
                      <div className="space-y-3">
                        {recentSessions.map((session) => (
                          <SessionRow key={session.id} session={session} />
                        ))}
                      </div>
                    )}
                  </WidgetCard>
                </DraggableWidgetWrapper>
              </div>
            )}

            {/* 오답 노트 위젯 */}
            {!hiddenWidgetIds.includes('wrong-notes') && (
              <div key="wrong-notes">
                <DraggableWidgetWrapper
                  editMode={editMode}
                  title="오답 노트"
                  removable
                  onHide={() => handleHideWidget('wrong-notes')}
                >
                  <WrongNotesWidget wrongAttempts={dashboardData.wrongAttempts} loading={loading} />
                </DraggableWidgetWrapper>
              </div>
            )}

            {/* 학습 약점 요약 위젯 */}
            {!hiddenWidgetIds.includes('weakness') && (
              <div key="weakness">
                <DraggableWidgetWrapper
                  editMode={editMode}
                  title="학습 약점 요약"
                  removable
                  onHide={() => handleHideWidget('weakness')}
                >
                  <WidgetCard title="학습 약점 요약" subtitle="정확도가 낮은 과목부터 먼저 보이도록 정렬했습니다." linkTo="/learning/weakness" linkLabel="학습약점 보기">
                    {loading ? (
                      <LoadingBlock compact />
                    ) : weakCategories.length === 0 ? (
                      <EmptyPanel title="아직 학습 데이터가 없습니다." description="학습 기록이 쌓이면 약점 분석이 표시됩니다." compact />
                    ) : (
                      <div className="mt-5 space-y-3">
                        {weakCategories.map((category) => (
                          <WeaknessRow key={category.name} category={category} />
                        ))}
                      </div>
                    )}
                  </WidgetCard>
                </DraggableWidgetWrapper>
              </div>
            )}

            {/* 학습 활동 히트맵 위젯 */}
            {!hiddenWidgetIds.includes('activity') && (
              <div key="activity">
                <DraggableWidgetWrapper
                  editMode={editMode}
                  title="학습 활동"
                  removable
                  onHide={() => handleHideWidget('activity')}
                >
                  <ActivityHeatmapWidget recentAttempts={dashboardData.learningStats.recentAttempts} loading={loading} />
                </DraggableWidgetWrapper>
              </div>
            )}

            {/* 최근 학습 기록 위젯 */}
            {showRecentLearningWidget && !hiddenWidgetIds.includes('recent-learning') && (
              <div key="recent-learning">
                <DraggableWidgetWrapper
                  editMode={editMode}
                  title="최근 학습 기록"
                  removable
                  onHide={() => handleHideWidget('recent-learning')}
                >
                  <WidgetCard title="최근 학습 기록" subtitle="최근에 푼 문제와 정답 여부를 빠르게 확인합니다." linkTo="/wrong-answers" linkLabel="오답노트 보기" linkMuted>
                    {loading ? (
                      <LoadingBlock compact />
                    ) : recentAttempts.length === 0 ? (
                      <EmptyPanel title="학습 기록이 아직 없습니다." description="문제를 풀기 시작하면 이 영역에 최근 기록이 표시됩니다." compact />
                    ) : (
                      <div className="mt-5 space-y-3">
                        {recentAttempts.map((attempt, index) => (
                          <RecentAttemptRow key={`${attempt.attemptedAt}-${index}`} attempt={attempt} />
                        ))}
                      </div>
                    )}
                  </WidgetCard>
                </DraggableWidgetWrapper>
              </div>
            )}

            {/* 메모장 위젯 */}
            {!hiddenWidgetIds.includes('memo') && (
              <div key="memo">
                <DraggableWidgetWrapper
                  editMode={editMode}
                  title="메모장"
                  removable
                  onHide={() => handleHideWidget('memo')}
                >
                  <MemoWidget loading={loading} />
                </DraggableWidgetWrapper>
              </div>
            )}

            {/* TO-DO 리스트 위젯 */}
            {!hiddenWidgetIds.includes('todo') && (
              <div key="todo">
                <DraggableWidgetWrapper
                  editMode={editMode}
                  title="TO-DO 리스트"
                  removable
                  onHide={() => handleHideWidget('todo')}
                >
                  <TodoWidget loading={loading} />
                </DraggableWidgetWrapper>
              </div>
            )}

            {/* 오늘의 연습질문 위젯 */}
            {!hiddenWidgetIds.includes('daily-practice') && (
              <div key="daily-practice">
                <DraggableWidgetWrapper
                  editMode={editMode}
                  title="오늘의 연습질문"
                  removable
                  onHide={() => handleHideWidget('daily-practice')}
                >
                  <DailyPracticeWidget loading={loading} />
                </DraggableWidgetWrapper>
              </div>
            )}
          </ResponsiveGridLayout>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   DraggableWidgetWrapper
   ════════════════════════════════════════════════════════════════ */

function DraggableWidgetWrapper({ title, editMode, removable = false, onHide, children }) {
  return (
    <div
      className={`flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-3xl bg-mentor-surface shadow-[var(--shadow-card)] transition-all ${
        editMode ? 'ring-2 ring-mentor-primary/30' : ''
      }`}
    >
      <div
        className={`${editMode ? 'widget-drag-handle' : ''} flex shrink-0 items-center gap-2 border-b border-mentor-border px-4 py-2.5 transition-colors ${
          editMode
            ? 'cursor-grab bg-mentor-accent/60 active:cursor-grabbing'
            : 'cursor-default bg-transparent'
        }`}
      >
        {editMode && (
          <svg className="h-4 w-4 shrink-0 text-mentor-primary" viewBox="0 0 16 16" fill="currentColor">
            <circle cx="4" cy="3" r="1.5" />
            <circle cx="12" cy="3" r="1.5" />
            <circle cx="4" cy="8" r="1.5" />
            <circle cx="12" cy="8" r="1.5" />
            <circle cx="4" cy="13" r="1.5" />
            <circle cx="12" cy="13" r="1.5" />
          </svg>
        )}
        <span className={`text-xs font-semibold ${editMode ? 'text-mentor-primary' : 'text-mentor-muted'}`}>
          {title}
        </span>
        {editMode && (
          <span className="ml-auto flex items-center gap-2">
            <span className="text-xs text-mentor-primary/70">드래그·리사이즈 가능</span>
            {removable && onHide && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onHide(); }}
                className="rounded-full bg-white/60 px-2.5 py-1 text-xs font-semibold text-mentor-muted transition hover:bg-red-50 hover:text-mentor-danger"
              >
                숨기기
              </button>
            )}
          </span>
        )}
      </div>
      <div className="flex-1 min-h-0 min-w-0 overflow-auto p-5">
        {children}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   공통 래퍼
   ════════════════════════════════════════════════════════════════ */

function WidgetCard({ title, subtitle, linkTo, linkLabel, linkMuted = false, children }) {
  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-mentor-text">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-mentor-muted">{subtitle}</p>}
        </div>
        {linkTo && (
          <Link
            to={linkTo}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              linkMuted
                ? 'bg-mentor-bg text-mentor-muted hover:bg-mentor-border hover:text-mentor-text'
                : 'bg-mentor-accent text-mentor-primary hover:bg-mentor-primary/10'
            }`}
          >
            {linkLabel}
          </Link>
        )}
      </div>
      {children}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   D-Day 위젯
   ════════════════════════════════════════════════════════════════ */

function DDayWidget({ jobPostings, loading }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const postingsWithDDay = (jobPostings || [])
    .filter((jp) => jp.dueDate)
    .map((jp) => {
      const due = new Date(jp.dueDate);
      due.setHours(0, 0, 0, 0);
      const diffMs = due - today;
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      return { ...jp, diffDays };
    })
    .filter((jp) => jp.diffDays >= 0)
    .sort((a, b) => a.diffDays - b.diffDays);

  if (loading) {
    return (
      <div>
        <p className="text-sm font-semibold text-mentor-muted">D-Day</p>
        <LoadingBlock compact />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-3">
        <p className="text-sm text-mentor-muted">등록된 채용공고의 지원 마감일을 보여줍니다.</p>
        <Link
          to="/profile/job-posting"
          className="rounded-full bg-mentor-accent px-4 py-2 text-sm font-semibold text-mentor-primary transition hover:bg-mentor-primary/10"
        >
          공고 관리
        </Link>
      </div>

      {postingsWithDDay.length === 0 ? (
        <EmptyPanel
          title="마감일이 등록된 공고가 없습니다."
          description="채용공고 등록 시 지원 마감일을 입력하면 D-Day가 표시됩니다."
          compact
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {postingsWithDDay.slice(0, 8).map((jp) => (
            <DDayCard key={jp.id} posting={jp} />
          ))}
        </div>
      )}
    </div>
  );
}

function DDayCard({ posting }) {
  const isUrgent = posting.diffDays <= 3;
  const isToday = posting.diffDays === 0;
  const ddayText = isToday ? 'D-Day' : `D-${posting.diffDays}`;

  return (
    <div
      className={`rounded-2xl border p-4 transition ${
        isUrgent ? 'border-red-200 bg-red-50' : 'border-mentor-border bg-white'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-mentor-text">{posting.company}</p>
          <p className="mt-1 truncate text-xs text-mentor-muted">{posting.position}</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
            isUrgent ? 'bg-red-100 text-red-600' : 'bg-mentor-accent text-mentor-primary'
          }`}
        >
          {ddayText}
        </span>
      </div>
      <p className="mt-3 text-xs text-mentor-muted">마감 {posting.dueDate}</p>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   위젯 1 — 면접 점수 추이 (LineChart)
   ════════════════════════════════════════════════════════════════ */

function ScoreTrendWidget({ allFeedbacks, loading }) {
  if (loading) return <LoadingBlock />;
  if (allFeedbacks.length < 2) {
    return (
      <EmptyPanel
        title="면접 데이터가 부족합니다."
        description="면접을 2회 이상 완료하면 점수 추이를 확인할 수 있습니다."
        compact
      />
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-mentor-muted">완료한 면접의 종합 점수 변화입니다.</p>
        <Link
          to="/interview/history"
          className="rounded-full bg-mentor-accent px-4 py-2 text-sm font-semibold text-mentor-primary transition hover:bg-mentor-primary/10"
        >
          전체 보기
        </Link>
      </div>
      <StableChartContainer heightClass="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={allFeedbacks} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#9ca3af' }} />
            <Tooltip
              contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', fontSize: '12px' }}
              formatter={(value) => [`${value}점`, '종합 점수']}
            />
            <Line
              type="monotone"
              dataKey="overallScore"
              stroke="#6366f1"
              strokeWidth={2.5}
              dot={{ r: 4, fill: '#6366f1' }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </StableChartContainer>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   위젯 2 — 과목별 학습 정확도 (BarChart)
   ════════════════════════════════════════════════════════════════ */

function AccuracyBarWidget({ categories, loading }) {
  if (loading) return <LoadingBlock />;
  if (categories.length === 0) {
    return (
      <EmptyPanel
        title="학습 데이터가 없습니다."
        description="학습 기록이 쌓이면 과목별 정확도를 비교할 수 있습니다."
        compact
      />
    );
  }

  const data = categories.map((cat) => ({ name: cat.name, 정확도: cat.accuracy ?? 0 }));

  return (
    <div>
      <p className="mb-4 text-sm text-mentor-muted">과목별 누적 정답률입니다.</p>
      <StableChartContainer heightClass="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9ca3af' }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#9ca3af' }} unit="%" />
            <Tooltip
              contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', fontSize: '12px' }}
              formatter={(value) => [`${value}%`, '정확도']}
            />
            <Bar dataKey="정확도" fill="#6366f1" radius={[6, 6, 0, 0]}>
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry['정확도'] < 60 ? '#ef4444' : '#6366f1'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </StableChartContainer>
      <p className="mt-2 text-xs text-mentor-muted">60% 미만 과목은 빨간색으로 표시됩니다.</p>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   위젯 3 — AI 학습 추천 카드
   ════════════════════════════════════════════════════════════════ */

function RecommendationWidget({ recommendation, loading }) {
  if (loading) return <LoadingBlock compact />;
  if (!recommendation) {
    return (
      <EmptyPanel
        title="추천 데이터가 없습니다."
        description="학습 기록이 쌓이면 AI가 다음에 공부할 과목을 추천합니다."
        compact
      />
    );
  }

  const difficultyLabel = {
    EASY: '쉬움',
    MEDIUM: '보통',
    HARD: '어려움',
  }[recommendation.difficulty] ?? recommendation.difficulty;

  const difficultyColor = {
    EASY: 'bg-emerald-50 text-emerald-600',
    MEDIUM: 'bg-amber-50 text-amber-600',
    HARD: 'bg-red-50 text-red-600',
  }[recommendation.difficulty] ?? 'bg-mentor-bg text-mentor-muted';

  return (
    <div className="flex h-full flex-col justify-between">
      <div>
        <p className="text-sm text-mentor-muted">학습 패턴을 분석해 AI가 추천하는 다음 과목입니다.</p>
        <div className="mt-4 rounded-2xl border border-mentor-border bg-mentor-bg p-4">
          <div className="flex items-center gap-2">
            <p className="text-base font-bold text-mentor-text">{recommendation.subjectName}</p>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${difficultyColor}`}>
              {difficultyLabel}
            </span>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs text-mentor-muted">현재 정확도</span>
            <div className="flex-1 h-2 overflow-hidden rounded-full bg-white border border-mentor-border">
              <div
                className="h-full rounded-full bg-mentor-primary"
                style={{ width: `${recommendation.currentAccuracy ?? 0}%` }}
              />
            </div>
            <span className="text-xs font-bold text-mentor-primary">{recommendation.currentAccuracy ?? 0}%</span>
          </div>
          {recommendation.reason && (
            <p className="mt-3 text-xs leading-5 text-mentor-muted">
              💡 {recommendation.reason}
            </p>
          )}
        </div>
      </div>
      <Link
        to="/learning"
        className="mt-4 block rounded-2xl bg-mentor-primary px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-mentor-primary-dark"
      >
        지금 학습 시작하기
      </Link>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   위젯 4 — 과목 마스터리 (PieChart 도넛)
   ════════════════════════════════════════════════════════════════ */

function MasteryPieWidget({ categories, loading }) {
  if (loading) return <LoadingBlock />;
  if (categories.length === 0) {
    return (
      <EmptyPanel
        title="학습 데이터가 없습니다."
        description="학습 기록이 쌓이면 과목별 시도 분포를 확인할 수 있습니다."
        compact
      />
    );
  }

  const data = categories.map((cat) => ({
    name: cat.name,
    value: cat.totalCount ?? 0,
    accuracy: cat.accuracy ?? 0,
  }));

  return (
    <div>
      <p className="mb-2 text-sm text-mentor-muted">과목별 학습 시도 횟수 분포입니다.</p>
      <StableChartContainer heightClass="h-[210px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={75}
              dataKey="value"
              nameKey="name"
              paddingAngle={2}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', fontSize: '12px' }}
              formatter={(value, name, props) => [`${value}회 (${props.payload.accuracy}%)`, name]}
            />
            <Legend
              iconType="circle"
              iconSize={8}
              formatter={(value) => (
                <span style={{ fontSize: '11px', color: '#6b7280' }}>{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </StableChartContainer>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   위젯 5 — 면접 역량 레이더 차트
   ════════════════════════════════════════════════════════════════ */

function RadarWidget({ allFeedbacks, loading }) {
  if (loading) return <LoadingBlock />;
  if (allFeedbacks.length === 0) {
    return (
      <EmptyPanel
        title="면접 데이터가 없습니다."
        description="면접을 완료하면 역량 분석이 표시됩니다."
        compact
      />
    );
  }

  const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const avgLogic = Math.round(avg(allFeedbacks.map((f) => f.logicScore)));
  const avgRelevance = Math.round(avg(allFeedbacks.map((f) => f.relevanceScore)));
  const avgSpecificity = Math.round(avg(allFeedbacks.map((f) => f.specificityScore)));
  const avgCommunication = Math.round(avg(allFeedbacks.map((f) => f.communicationScore ?? 0)));
  const avgProfessionalism = Math.round(avg(allFeedbacks.map((f) => f.professionalismScore ?? 0)));

  // allFeedbacks는 시간 오름차순이므로 마지막이 가장 최근
  const latest = allFeedbacks[allFeedbacks.length - 1];

  const radarData = [
    { metric: '논리성', 최근: latest.logicScore, 평균: avgLogic },
    { metric: '관련성', 최근: latest.relevanceScore, 평균: avgRelevance },
    { metric: '구체성', 최근: latest.specificityScore, 평균: avgSpecificity },
    { metric: '의사소통', 최근: latest.communicationScore ?? 0, 평균: avgCommunication },
    { metric: '전문성', 최근: latest.professionalismScore ?? 0, 평균: avgProfessionalism },
  ];

  return (
    <div>
      <p className="mb-2 text-sm text-mentor-muted">최근 면접과 전체 평균을 비교합니다. (100점 만점)</p>
      <StableChartContainer heightClass="h-[210px]">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={radarData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
            <PolarGrid stroke="#e5e7eb" />
            <PolarAngleAxis dataKey="metric" tick={{ fontSize: 12, fill: '#6b7280' }} />
            <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
            <Radar
              name="최근 면접"
              dataKey="최근"
              stroke="#6366f1"
              fill="#6366f1"
              fillOpacity={0.3}
            />
            {allFeedbacks.length > 1 && (
              <Radar
                name="전체 평균"
                dataKey="평균"
                stroke="#10b981"
                fill="#10b981"
                fillOpacity={0.15}
              />
            )}
            <Legend iconSize={8} formatter={(value) => (
              <span style={{ fontSize: '11px', color: '#6b7280' }}>{value}</span>
            )} />
            <Tooltip
              contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', fontSize: '12px' }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </StableChartContainer>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   위젯 6 — 학습 활동 히트맵 (CSS Grid)
   ════════════════════════════════════════════════════════════════ */

function ActivityHeatmapWidget({ recentAttempts, loading }) {
  if (loading) return <LoadingBlock compact />;

  // recentAttempts의 날짜별 카운트 집계
  const countByDate = {};
  for (const attempt of recentAttempts) {
    const raw = attempt.attemptedAt || attempt.createdAt;
    if (!raw) continue;
    const dateKey = new Date(raw).toISOString().split('T')[0];
    countByDate[dateKey] = (countByDate[dateKey] || 0) + 1;
  }

  // 최근 28일 (4주) 배열 생성
  const today = new Date();
  const days = [];
  for (let i = 27; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    days.push({ date: key, count: countByDate[key] || 0, dayOfWeek: d.getDay() });
  }

  // 첫 날 요일에 맞게 앞에 빈 셀 추가 (월요일 시작)
  const startDow = days[0].dayOfWeek === 0 ? 6 : days[0].dayOfWeek - 1;
  const paddedDays = [...Array(startDow).fill(null), ...days];

  const totalActivity = days.reduce((sum, d) => sum + d.count, 0);
  const DOW_LABELS = ['월', '화', '수', '목', '금', '토', '일'];

  function cellColor(count) {
    if (count === 0) return 'bg-mentor-bg border-mentor-border';
    if (count <= 2) return 'bg-emerald-200 border-emerald-300';
    if (count <= 5) return 'bg-emerald-400 border-emerald-500';
    return 'bg-emerald-600 border-emerald-700';
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-mentor-muted">최근 4주 학습 활동 현황입니다.</p>
        <span className="text-xs font-semibold text-mentor-primary">{totalActivity}회</span>
      </div>

      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {DOW_LABELS.map((d) => (
          <div key={d} className="text-center text-xs text-mentor-muted">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {paddedDays.map((day, i) =>
          day === null ? (
            <div key={`pad-${i}`} className="aspect-square" />
          ) : (
            <div
              key={day.date}
              title={`${day.date}: ${day.count}회`}
              className={`aspect-square rounded border ${cellColor(day.count)}`}
            />
          )
        )}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <span className="text-xs text-mentor-muted">적음</span>
        {['bg-mentor-bg border-mentor-border', 'bg-emerald-200 border-emerald-300', 'bg-emerald-400 border-emerald-500', 'bg-emerald-600 border-emerald-700'].map((cls, i) => (
          <div key={i} className={`h-3 w-3 rounded border ${cls}`} />
        ))}
        <span className="text-xs text-mentor-muted">많음</span>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   위젯 7 — 구독 상태
   ════════════════════════════════════════════════════════════════ */

function SubscriptionWidget({ subscription, loading }) {
  if (loading) return <LoadingBlock compact />;

  if (!subscription || subscription.status === 'EXPIRED' || subscription.status === 'CANCELLED' || subscription.status === 'PAYMENT_FAILED') {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center">
        <p className="text-2xl">🎫</p>
        <p className="mt-3 text-sm font-semibold text-mentor-text">
          {subscription ? '구독이 만료되었습니다.' : '구독 중인 플랜이 없습니다.'}
        </p>
        <p className="mt-1 text-xs text-mentor-muted">구독하고 면접, 학습 기능을 이용하세요.</p>
        <Link
          to="/subscription"
          className="mt-4 rounded-full bg-mentor-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-mentor-primary-dark"
        >
          구독 시작하기
        </Link>
      </div>
    );
  }

  const isActive = subscription.status === 'ACTIVE';
  const startDate = subscription.startedAt ? new Date(subscription.startedAt) : null;
  const expiresDate = subscription.expiresAt ? new Date(subscription.expiresAt) : null;
  const now = new Date();

  let remainDays = 0;
  let progressPct = 100;
  if (startDate && expiresDate) {
    const totalMs = expiresDate - startDate;
    const elapsedMs = now - startDate;
    remainDays = Math.max(0, Math.ceil((expiresDate - now) / (1000 * 60 * 60 * 24)));
    progressPct = Math.min(100, Math.max(0, Math.round((elapsedMs / totalMs) * 100)));
  }

  const progressColor = remainDays <= 3 ? 'bg-red-400' : remainDays <= 7 ? 'bg-amber-400' : 'bg-mentor-primary';

  return (
    <div className="flex h-full flex-col justify-between">
      <div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-base font-bold text-mentor-text">{subscription.planName}</p>
            <span className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
            }`}>
              {isActive ? '이용 중' : subscription.status}
            </span>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-mentor-primary">{remainDays}</p>
            <p className="text-xs text-mentor-muted">일 남음</p>
          </div>
        </div>

        <div className="mt-4">
          <div className="flex justify-between text-xs text-mentor-muted mb-1">
            <span>사용 기간</span>
            <span>{progressPct}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-mentor-bg">
            <div className={`h-full rounded-full transition-all ${progressColor}`} style={{ width: `${progressPct}%` }} />
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-mentor-muted">
          {startDate && <p>시작 {startDate.toLocaleDateString('ko-KR')}</p>}
          {expiresDate && <p className="text-right">만료 {expiresDate.toLocaleDateString('ko-KR')}</p>}
        </div>
      </div>

      <Link
        to="/subscription"
        className="mt-4 block rounded-2xl border border-mentor-border bg-mentor-bg px-4 py-2.5 text-center text-sm font-semibold text-mentor-muted transition hover:bg-mentor-border hover:text-mentor-text"
      >
        구독 관리
      </Link>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   위젯 8 — 오답 노트 미리보기
   ════════════════════════════════════════════════════════════════ */

function WrongNotesWidget({ wrongAttempts, loading }) {
  const preview = (wrongAttempts || []).slice(0, 3);

  return (
    <WidgetCard title="오답 노트" subtitle="최근 틀린 문제를 복습하세요." linkTo="/wrong-answers" linkLabel="전체 보기" linkMuted>
      {loading ? (
        <LoadingBlock compact />
      ) : preview.length === 0 ? (
        <EmptyPanel title="틀린 문제가 없습니다." description="학습을 시작하면 오답 노트가 채워집니다." compact />
      ) : (
        <div className="space-y-3">
          {preview.map((attempt, index) => (
            <WrongNoteCard key={index} attempt={attempt} />
          ))}
        </div>
      )}
    </WidgetCard>
  );
}

function WrongNoteCard({ attempt }) {
  return (
    <div className="rounded-2xl border border-red-100 bg-red-50 p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-mentor-text line-clamp-2">{attempt.question}</p>
        {attempt.subjectName && (
          <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-600">
            {attempt.subjectName}
          </span>
        )}
      </div>
      {attempt.aiFeedback && (
        <p className="mt-2 text-xs leading-5 text-mentor-muted line-clamp-2">
          💡 {attempt.aiFeedback}
        </p>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   하위 컴포넌트
   ════════════════════════════════════════════════════════════════ */

function MiniCount({ label, value, to }) {
  return (
    <Link
      to={to}
      className="rounded-2xl bg-mentor-accent/60 px-3 py-4 text-center transition hover:bg-mentor-accent border border-mentor-border"
    >
      <p className="text-xs text-mentor-muted">{label}</p>
      <p className="mt-2 text-2xl font-bold text-mentor-primary">{value}</p>
    </Link>
  );
}

function StatCard({ emoji, title, value, suffix = '', description }) {
  const numericValue = typeof value === 'number' ? value : 0;
  const animated = useCountUp(numericValue);
  const displayValue = value === null ? '-' : `${animated}${suffix}`;

  return (
    <article className="rounded-3xl bg-white border border-mentor-border p-6 shadow-[var(--shadow-card)] transition-all duration-200 hover:shadow-[var(--shadow-card-hover)] hover:-translate-y-1">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-mentor-accent text-xl">
        {emoji}
      </span>
      <p className="mt-4 text-sm font-semibold text-mentor-muted">{title}</p>
      <p className="mt-2 text-3xl font-bold text-mentor-primary">{displayValue}</p>
      <p className="mt-1 text-xs text-mentor-muted">{description}</p>
    </article>
  );
}

function RecentFeedbackWidget({ feedback }) {
  const metrics = [
    { label: '논리성', score: feedback.logicScore, max: 100 },
    { label: '관련성', score: feedback.relevanceScore, max: 100 },
    { label: '구체성', score: feedback.specificityScore, max: 100 },
    { label: '의사소통', score: feedback.communicationScore ?? 0, max: 100 },
    { label: '전문성', score: feedback.professionalismScore ?? 0, max: 100 },
  ];

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-mentor-muted">가장 최근에 완료한 면접의 핵심 평가 점수입니다.</p>
        <Link
          to={`/interview/result/${feedback.sessionId}`}
          className="shrink-0 rounded-full bg-mentor-accent px-4 py-2 text-sm font-semibold text-mentor-primary transition hover:bg-mentor-primary/10"
        >
          상세 보기
        </Link>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-[160px_1fr]">
        <div className="flex flex-col items-center justify-center rounded-3xl bg-mentor-bg px-4 py-5">
          <p className="text-xs font-semibold text-mentor-muted">종합 점수</p>
          <p className="mt-2 text-4xl font-bold text-mentor-primary">{feedback.overallScore}</p>
          <p className="mt-1 text-xs text-mentor-muted">/ 100</p>
        </div>

        <div className="space-y-3">
          {metrics.map((metric) => (
            <MetricBar key={metric.label} {...metric} />
          ))}
        </div>
      </div>
    </div>
  );
}

function SessionRow({ session }) {
  const isCompleted = session.status === 'COMPLETED';
  const isOngoing = session.status === 'ONGOING';

  const sessionTitle = session.company
    ? `${session.company}${session.position ? ` · ${session.position}` : ''}`
    : session.resumeName
      ? session.resumeName
      : `면접 #${session.id}`;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-mentor-border px-4 py-4">
      <div>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              isCompleted ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
            }`}
          >
            {isCompleted ? '완료' : '진행 중'}
          </span>
          <span className="text-sm font-semibold text-mentor-text">{sessionTitle}</span>
        </div>
        <p className="mt-2 text-sm text-mentor-muted">
          시작일 {formatDateTime(session.startedAt || session.createdAt)}
        </p>
      </div>

      <div className="flex gap-2">
        {isCompleted && (
          <>
            <Link
              to={`/interview/sessions/${session.id}`}
              className="rounded-full bg-mentor-bg px-4 py-2 text-sm font-semibold text-mentor-text transition hover:bg-mentor-border"
            >
              Q&A 보기
            </Link>
            <Link
              to={`/interview/result/${session.id}`}
              className="rounded-full bg-mentor-accent px-4 py-2 text-sm font-semibold text-mentor-primary transition hover:bg-mentor-primary/10"
            >
              결과 보기
            </Link>
          </>
        )}
        {isOngoing && (
          <>
            <Link
              to={`/interview/session/${session.id}`}
              className="rounded-full bg-mentor-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-mentor-primary-dark"
            >
              이어서 하기
            </Link>
            <Link
              to={`/interview/history`}
              className="rounded-full bg-mentor-bg px-4 py-2 text-sm font-semibold text-mentor-text transition hover:bg-mentor-border"
            >
              면접 이력
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

function WeaknessRow({ category }) {
  return (
    <div className="rounded-2xl border border-mentor-border px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-mentor-text">{category.name}</p>
          {category.isWeak && (
            <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-mentor-danger">
              보완 우선
            </span>
          )}
        </div>
        <p className="text-sm font-bold text-mentor-primary">{category.accuracy}%</p>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-mentor-bg">
        <div
          className={`h-full rounded-full ${category.isWeak ? 'bg-red-400' : 'bg-mentor-primary'}`}
          style={{ width: `${category.accuracy}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-mentor-muted">{category.totalCount}회 시도</p>
    </div>
  );
}

function RecentAttemptRow({ attempt }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-mentor-border px-4 py-3">
      <div>
        <p className="text-sm font-semibold text-mentor-text">{attempt.subjectName}</p>
        <p className="mt-1 text-xs text-mentor-muted">
          {attempt.problemType === 'MULTIPLE' ? '객관식' : '주관식'} · {formatDateTime(attempt.attemptedAt)}
        </p>
      </div>
      <span
        className={`rounded-full px-3 py-1 text-xs font-semibold ${
          attempt.isCorrect ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-mentor-danger'
        }`}
      >
        {attempt.isCorrect ? '정답' : '오답'}
      </span>
    </div>
  );
}

function MetricBar({ label, score, max }) {
  const percent = Math.round((score / max) * 100);
  const colorClass =
    percent >= 70 ? 'bg-emerald-500' : percent >= 40 ? 'bg-amber-400' : 'bg-red-400';

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-mentor-text">{label}</span>
        <span className="text-sm font-bold text-mentor-text">{score}<span className="text-xs font-normal text-mentor-muted">/{max}</span></span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-mentor-bg">
        <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function LoadingBlock({ compact = false }) {
  return (
    <div className={`flex justify-center ${compact ? 'py-8' : 'py-16'}`}>
      <span className="h-8 w-8 animate-spin rounded-full border-4 border-mentor-accent border-t-mentor-primary" />
    </div>
  );
}

/**
 * Recharts는 부모 크기 계산이 끝나기 전에 먼저 렌더되면 width/height를 -1로 읽고
 * 콘솔 경고를 남길 수 있습니다.
 *
 * react-grid-layout + flex 조합에서는 첫 마운트 직후 한 프레임 정도 레이아웃이 더
 * 흔들릴 수 있어서, 차트는 한 박자 늦게 그리도록 감싸 줍니다.
 */
function StableChartContainer({ heightClass = 'h-[200px]', children }) {
  const [isChartReady, setIsChartReady] = useState(false);

  useEffect(() => {
    let firstFrameId = 0;
    let secondFrameId = 0;

    // 차트 부모 크기가 실제 DOM에 반영된 뒤 그리도록 requestAnimationFrame을 두 번 기다립니다.
    firstFrameId = window.requestAnimationFrame(() => {
      secondFrameId = window.requestAnimationFrame(() => {
        setIsChartReady(true);
      });
    });

    return () => {
      window.cancelAnimationFrame(firstFrameId);
      window.cancelAnimationFrame(secondFrameId);
    };
  }, []);

  return (
    <div className={`${heightClass} w-full min-h-0 min-w-0`}>
      {isChartReady ? children : <LoadingBlock compact />}
    </div>
  );
}

function EmptyPanel({ title, description, compact = false }) {
  return (
    <div
      className={`rounded-2xl border border-dashed border-mentor-border text-center ${
        compact ? 'px-6 py-10' : 'px-6 py-14'
      }`}
    >
      <p className="text-base font-semibold text-mentor-text">{title}</p>
      <p className="mt-2 text-sm text-mentor-muted">{description}</p>
    </div>
  );
}

function formatDateTime(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('ko-KR');
}

/** 차트 X축용 짧은 날짜 (M/D 형식) */
function formatDateShort(value) {
  if (!value) return '';
  const d = new Date(value);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/**
 * getGrowthReport 응답을 ScoreTrendWidget / RadarWidget이 사용하는 allFeedbacks 형태로 변환합니다.
 * GrowthReportDto.SessionScoreDto → { date, sessionId, overallScore, logicScore, ... }
 *
 * @param {PromiseSettledResult} result - growthReportResult
 * @returns {Array}
 */
function buildAllFeedbacks(result) {
  if (result.status !== 'fulfilled') return [];
  const sessions = result.value.data.data?.sessions ?? [];
  return sessions.map((s) => ({
    date: formatDateShort(s.completedAt),
    sessionId: s.sessionId,
    sessionNum: s.sessionNum,
    overallScore: s.overallScore ?? 0,
    logicScore: s.logicScore ?? 0,
    relevanceScore: s.relevanceScore ?? 0,
    specificityScore: s.specificityScore ?? 0,
    communicationScore: s.communicationScore ?? 0,
    professionalismScore: s.professionalismScore ?? 0,
    attitudeScore: s.attitudeScore ?? 0,
    starScore: s.starScore ?? 0,
    consistencyScore: s.consistencyScore ?? 0,
  }));
}
