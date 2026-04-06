import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as learningApi from '../../api/learning';

/**
 * 학습 약점 분석 페이지입니다.
 *
 * [역할]
 * 과목별 정확도, 추천 과목, 전체 통계를 한 화면에 보여주고
 * 바로 심화 학습으로 이어질 수 있게 연결합니다.
 */
export default function LearningWeaknessPage() {
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState([]);
  const [stats, setStats] = useState(null);
  const [recommendation, setRecommendation] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchWeaknessData() {
      setLoading(true);
      setError('');

      try {
        const [analyticsResult, statsResult, recommendationResult, subjectsResult] = await Promise.all([
          learningApi.getAnalytics(),
          learningApi.getStats(),
          learningApi.getRecommendation(),
          learningApi.getSubjects(),
        ]);

        setAnalytics(normalizeAnalyticsCategories(analyticsResult.data.data?.categories ?? []));
        setStats(statsResult.data.data ?? null);
        setRecommendation(recommendationResult.data.data ?? null);
        setSubjects(subjectsResult.data.data ?? []);
      } catch (requestError) {
        setError(
          requestError.response?.data?.error?.message ??
            '학습 약점 데이터를 불러오지 못했습니다.'
        );
      } finally {
        setLoading(false);
      }
    }

    fetchWeaknessData();
  }, []);

  const sortedCategories = useMemo(() => {
    return [...analytics].sort((left, right) => {
      if (left.isWeak !== right.isWeak) {
        return left.isWeak ? -1 : 1;
      }

      return (left.accuracy ?? 0) - (right.accuracy ?? 0);
    });
  }, [analytics]);

  const moveToDeepLearning = (target) => {
    const matchedSubject = subjects.find((subject) => subject.name === (target.subjectName ?? target.name ?? ''));

    navigate('/learning', {
      state: {
        deepLearningPreset: {
          subjectId: target.subjectId ?? target.id ?? matchedSubject?.id ?? null,
          subjectName: target.subjectName ?? target.name ?? '',
          difficulty: target.difficulty ?? getDifficultyFromAccuracy(target.accuracy),
          count: target.count ?? getCountFromAccuracy(target.accuracy),
          type: 'MIX',
          reason:
            target.reason ??
            `${target.subjectName ?? target.name ?? '선택한 과목'}의 약한 부분을 다시 복습하도록 추천합니다.`,
          source: 'weakness-page',
        },
      },
    });
  };

  return (
    <div className="min-h-screen bg-mentor-bg px-4 py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="grid gap-6 rounded-[28px] bg-mentor-surface p-7 shadow-[var(--shadow-card)] lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <p className="text-sm font-semibold text-mentor-primary">학습 약점 보기</p>
            <h1 className="mt-3 text-3xl font-bold text-mentor-text">
              약한 과목을 먼저 찾고 학습 순서를 정리하세요
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-mentor-muted">
              정확도, 최근 시도 수, 추천 과목을 같이 보여 주어서 지금 무엇을 먼저 복습해야 하는지
              빠르게 판단할 수 있게 정리했습니다.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/learning"
                className="rounded-full bg-mentor-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-mentor-primary-dark"
              >
                일반 학습으로 이동
              </Link>
              <Link
                to="/wrong-answers"
                className="rounded-full border border-mentor-border bg-mentor-surface px-4 py-2 text-sm font-semibold text-mentor-muted transition hover:border-mentor-primary hover:text-mentor-primary"
              >
                오답노트 보기
              </Link>
            </div>
          </div>

          <div className="rounded-3xl bg-gradient-to-br from-mentor-primary to-mentor-sky p-6 text-white">
            <p className="text-sm font-semibold text-white/80">추천 학습</p>
            {loading ? (
              <p className="mt-4 text-sm text-white/70">추천 데이터를 계산 중입니다.</p>
            ) : recommendation ? (
              <>
                <p className="mt-4 text-2xl font-bold">{recommendation.subjectName}</p>
                <p className="mt-2 text-sm text-white/80">{recommendation.reason}</p>
                <div className="mt-6 grid grid-cols-2 gap-3">
                  <StatTile label="추천 난이도" value={getDifficultyLabel(recommendation.difficulty)} />
                  <StatTile label="현재 정확도" value={`${recommendation.currentAccuracy ?? 0}%`} />
                </div>
                <button
                  type="button"
                  onClick={() => moveToDeepLearning(recommendation)}
                  className="mt-5 w-full rounded-2xl bg-white/15 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/25"
                >
                  이 과목으로 심화 학습 시작
                </button>
              </>
            ) : (
              <p className="mt-4 text-sm text-white/70">학습 기록이 쌓이면 맞춤 추천이 표시됩니다.</p>
            )}
          </div>
        </section>

        {error && (
          <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-3">
          <SummaryCard
            title="전체 시도"
            value={loading ? '-' : stats?.totalAttempts ?? 0}
            description="누적 학습 시도 수"
          />
          <SummaryCard
            title="정답 수"
            value={loading ? '-' : stats?.correctAttempts ?? 0}
            description="누적 정답 처리 수"
          />
          <SummaryCard
            title="정확도"
            value={loading ? '-' : `${stats?.accuracyRate ?? 0}%`}
            description="현재 누적 기준"
          />
        </section>

        <section className="rounded-3xl bg-mentor-surface p-6 shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-mentor-text">과목별 약점 우선순위</h2>
              <p className="mt-1 text-sm text-mentor-muted">
                정확도가 낮거나 학습량이 적은 과목을 먼저 보이도록 정렬했습니다.
              </p>
            </div>
            <Link
              to="/subscription"
              className="rounded-full bg-mentor-accent px-4 py-2 text-sm font-semibold text-mentor-primary transition hover:bg-mentor-primary hover:text-white"
            >
              구독 요금 보기
            </Link>
          </div>

          {loading && (
            <div className="flex justify-center py-14">
              <span className="h-8 w-8 animate-spin rounded-full border-4 border-mentor-accent border-t-mentor-primary" />
            </div>
          )}

          {!loading && sortedCategories.length === 0 && (
            <div className="rounded-2xl border border-dashed border-mentor-border px-6 py-16 text-center">
              <p className="text-sm text-mentor-muted">표시할 약점 데이터가 아직 없습니다.</p>
            </div>
          )}

          {!loading && sortedCategories.length > 0 && (
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {sortedCategories.map((category) => (
                <article
                  key={category.name}
                  className="rounded-3xl border border-mentor-border p-5 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-card-hover)]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-mentor-text">{category.name}</h3>
                      {category.isWeak && (
                        <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600">
                          보완 우선
                        </span>
                      )}
                    </div>
                    <span className="text-lg font-bold text-mentor-primary">{category.accuracy}%</span>
                  </div>

                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-mentor-bg">
                    <div
                      className={`h-full rounded-full ${category.isWeak ? 'bg-red-400' : 'bg-mentor-primary'}`}
                      style={{ width: `${category.accuracy}%` }}
                    />
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-2xl bg-mentor-bg px-4 py-3">
                      <p className="text-xs text-mentor-muted">시도 수</p>
                      <p className="mt-1 font-semibold text-mentor-text">{category.totalCount}</p>
                    </div>
                    <div className="rounded-2xl bg-mentor-bg px-4 py-3">
                      <p className="text-xs text-mentor-muted">정답 수</p>
                      <p className="mt-1 font-semibold text-mentor-text">{category.correctCount}</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => moveToDeepLearning(category)}
                    className="mt-4 w-full rounded-2xl bg-mentor-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-mentor-primary-dark"
                  >
                    이 과목으로 심화 학습 시작
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function normalizeAnalyticsCategories(categories = []) {
  return categories.map((category, index) => ({
    ...category,
    name: category.name ?? category.subjectName ?? `과목 ${index + 1}`,
  }));
}

function SummaryCard({ title, value, description }) {
  return (
    <article className="rounded-3xl bg-mentor-surface p-6 shadow-[var(--shadow-card)]">
      <p className="text-sm font-semibold text-mentor-muted">{title}</p>
      <p className="mt-3 text-3xl font-bold text-mentor-primary">{value}</p>
      <p className="mt-2 text-sm text-mentor-muted">{description}</p>
    </article>
  );
}

function StatTile({ label, value }) {
  return (
    <div className="rounded-2xl bg-white/10 px-4 py-4">
      <p className="text-xs text-white/70">{label}</p>
      <p className="mt-2 text-lg font-bold text-white">{value}</p>
    </div>
  );
}

function getDifficultyLabel(value) {
  if (value === 'EASY') {
    return '쉬움';
  }

  if (value === 'HARD') {
    return '어려움';
  }

  return '보통';
}

function getDifficultyFromAccuracy(accuracy) {
  if (typeof accuracy !== 'number') {
    return 'MEDIUM';
  }

  if (accuracy < 40) {
    return 'EASY';
  }

  if (accuracy >= 75) {
    return 'HARD';
  }

  return 'MEDIUM';
}

function getCountFromAccuracy(accuracy) {
  if (typeof accuracy !== 'number') {
    return 4;
  }

  if (accuracy < 40) {
    return 8;
  }

  return 4;
}
