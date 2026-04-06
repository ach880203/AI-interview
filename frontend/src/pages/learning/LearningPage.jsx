import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import * as learningApi from '../../api/learning';
import AiWorkStatusCard from '../../components/common/AiWorkStatusCard';
import Button from '../../components/ui/Button';

/**
 * 학습 설정 페이지
 *
 * [역할]
 * 사용자가 과목, 난이도, 문제 유형, 문제 수를 정하면
 * AI 문제 생성 요청을 보내고 학습 세션으로 이동합니다.
 *
 * [심화 학습 연결]
 * 다른 화면에서 넘어온 추천 설정이 있으면 기본값으로 자동 적용합니다.
 * 이 단계에서는 백엔드 API를 새로 나누지 않고,
 * 현재 학습 생성 API를 재사용해서 복습 흐름을 먼저 완성합니다.
 */
export default function LearningPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const deepLearningPreset = useMemo(() => {
    const preset = location.state?.deepLearningPreset;

    if (!preset || typeof preset !== 'object') {
      return null;
    }

    return {
      subjectId: preset.subjectId ?? null,
      subjectName: preset.subjectName ?? '',
      difficulty: preset.difficulty ?? 'MEDIUM',
      count: preset.count ?? 4,
      type: preset.type ?? 'MIX',
      reason: preset.reason ?? '',
      source: preset.source ?? 'deep-learning',
    };
  }, [location.state]);

  const [subjects, setSubjects] = useState([]);
  const [selectedId, setSelectedId] = useState(deepLearningPreset?.subjectId ?? null);
  const [difficulty, setDifficulty] = useState(deepLearningPreset?.difficulty ?? 'MEDIUM');
  const [count, setCount] = useState(deepLearningPreset?.count ?? 4);
  const [type, setType] = useState(deepLearningPreset?.type ?? 'MIX');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [recommendation, setRecommendation] = useState(null);

  useEffect(() => {
    Promise.allSettled([
      learningApi.getSubjects(),
      learningApi.getRecommendation(),
    ])
      .then(([subjectResult, recommendResult]) => {
        if (subjectResult.status === 'fulfilled') {
          setSubjects(subjectResult.value.data.data ?? []);
        } else {
          setError('과목 목록을 불러오지 못했습니다.');
        }

        if (recommendResult.status === 'fulfilled') {
          setRecommendation(recommendResult.value.data.data ?? null);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!deepLearningPreset?.subjectId || subjects.length === 0) {
      return;
    }

    const hasMatchingSubject = subjects.some((subject) => subject.id === deepLearningPreset.subjectId);
    if (!hasMatchingSubject) {
      setSelectedId(null);
      setError('심화 학습 대상 과목을 찾지 못해 기본 학습 설정으로 전환했습니다.');
    }
  }, [deepLearningPreset, subjects]);

  const applyRecommendation = () => {
    if (!recommendation) {
      return;
    }

    setSelectedId(recommendation.subjectId);
    setDifficulty(recommendation.difficulty);
    setCount(4);
    setType('MIX');
    setError('');
  };

  const handleStart = async () => {
    if (!selectedId) {
      setError('학습할 과목을 선택해 주세요.');
      return;
    }

    setGenerating(true);
    setError('');

    try {
      const { data } = await learningApi.generateProblems(selectedId, {
        difficulty,
        count,
        type,
      });

      const problems = data?.data;
      if (!problems?.length) {
        setError('문제 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.');
        return;
      }

      const subjectName = subjects.find((subject) => subject.id === selectedId)?.name ?? deepLearningPreset?.subjectName ?? '';
      const sessionKey = createLearningSessionKey();

      navigate(`/learning/session?sessionKey=${sessionKey}`, {
        state: {
          problems,
          subjectName,
          difficulty,
          count,
          type,
          subjectId: selectedId,
          sessionKey,
          learningMode: deepLearningPreset ? 'DEEP' : 'NORMAL',
        },
      });
    } catch (requestError) {
      const message =
        requestError.response?.data?.error?.message ??
        '문제 생성 중 오류가 발생했습니다.';
      setError(message);
    } finally {
      setGenerating(false);
    }
  };

  const pageTitle = deepLearningPreset ? '심화 학습' : 'AI 학습';
  const pageDescription = deepLearningPreset
    ? '방금 학습한 결과를 바탕으로 약한 부분을 한 번 더 정리합니다.'
    : '과목과 옵션을 선택하면 AI가 맞춤형 문제를 생성합니다.';

  return (
    <div className="min-h-screen bg-mentor-bg px-4 py-10">
      <div className="mx-auto flex max-w-2xl flex-col gap-8">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-mentor-accent">
            <span className="text-3xl" aria-hidden="true">{deepLearningPreset ? '🧠' : '📚'}</span>
          </div>
          <h1 className="text-2xl font-bold text-mentor-text">{pageTitle}</h1>
          <p className="mt-2 text-sm text-mentor-muted">{pageDescription}</p>
        </div>

        {deepLearningPreset && (
          <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">심화 학습 추천</p>
                <p className="mt-1 text-sm font-semibold text-mentor-text">
                  {deepLearningPreset.subjectName || '복습 대상 과목'}
                </p>
                <p className="mt-1 text-xs text-emerald-700">
                  {deepLearningPreset.reason || '직전 학습 결과를 기준으로 복습 설정을 자동으로 채웠습니다.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/learning/weakness')}
                className="shrink-0 rounded-lg border border-emerald-300 bg-white px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
              >
                약점 분석 보기
              </button>
            </div>
          </section>
        )}

        {!deepLearningPreset && recommendation && (
          <section className="rounded-2xl border border-mentor-primary-light bg-mentor-accent p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-mentor-primary">AI 맞춤 추천</p>
                <p className="mt-1 text-sm font-semibold text-mentor-text">{recommendation.subjectName}</p>
                <p className="mt-1 text-xs text-mentor-primary">{recommendation.reason}</p>
              </div>
              <button
                type="button"
                onClick={applyRecommendation}
                className="shrink-0 rounded-lg bg-mentor-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-mentor-primary-dark active:scale-95"
              >
                추천 학습 시작
              </button>
            </div>
          </section>
        )}

        <section className="rounded-2xl bg-mentor-surface p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-mentor-text">과목 선택</h2>

          {loading ? (
            <div className="flex justify-center py-8">
              <span className="h-7 w-7 animate-spin rounded-full border-4 border-mentor-accent border-t-mentor-primary" />
            </div>
          ) : subjects.length === 0 ? (
            <p className="py-6 text-center text-sm text-mentor-muted">
              등록된 과목이 없습니다.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {subjects.map((subject) => (
                <SubjectCard
                  key={subject.id}
                  subject={subject}
                  isSelected={selectedId === subject.id}
                  onSelect={() => {
                    setSelectedId(subject.id);
                    setError('');
                  }}
                />
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl bg-mentor-surface p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-mentor-text">난이도</h2>
          <div className="flex gap-3">
            {DIFFICULTY_OPTIONS.map(({ value, label, color }) => (
              <OptionButton
                key={value}
                label={label}
                isSelected={difficulty === value}
                colorClass={color}
                onClick={() => setDifficulty(value)}
              />
            ))}
          </div>
        </section>

        <section className="rounded-2xl bg-mentor-surface p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-mentor-text">문제 유형</h2>
          <div className="flex gap-3">
            {TYPE_OPTIONS.map(({ value, label }) => (
              <OptionButton
                key={value}
                label={label}
                isSelected={type === value}
                onClick={() => setType(value)}
              />
            ))}
          </div>
        </section>

        <section className="rounded-2xl bg-mentor-surface p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-mentor-text">
            문제 수
            <span className="ml-2 font-bold text-mentor-primary">{count}개</span>
          </h2>
          <div className="flex gap-3">
            {COUNT_OPTIONS.map((problemCount) => (
              <OptionButton
                key={problemCount}
                label={`${problemCount}문제`}
                isSelected={count === problemCount}
                onClick={() => setCount(problemCount)}
              />
            ))}
          </div>
        </section>

        {error && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {generating && (
          <AiWorkStatusCard
            title="AI가 학습 문제를 생성하고 있습니다."
            description="선택한 과목과 설정을 기준으로 문제를 정리하고 있습니다."
            hint="문제 수에 따라 최대 1분 정도 걸릴 수 있습니다."
          />
        )}

        <Button onClick={handleStart} loading={generating}>
          {generating ? 'AI 문제 생성 중...' : deepLearningPreset ? '심화 학습 시작하기' : '학습 시작하기'}
        </Button>
      </div>
    </div>
  );
}

/** 과목 이름에 어울리는 아이콘을 간단히 매핑합니다. */
const SUBJECT_ICON_MAP = {
  영어: '🇺🇸',
  english: '🇺🇸',
  국사: '🏺',
  한국사: '🏺',
  역사: '🏺',
  IT: '💻',
  자바: '☕',
  Java: '☕',
  파이썬: '🐍',
  Python: '🐍',
  운영체제: '🧩',
  데이터베이스: '🗄️',
  DB: '🗄️',
  네트워크: '🛜',
  알고리즘: '🧮',
  자료구조: '🧱',
};

function getSubjectIcon(name = '') {
  const lowerName = name.toLowerCase();

  for (const [keyword, icon] of Object.entries(SUBJECT_ICON_MAP)) {
    if (lowerName.includes(keyword.toLowerCase())) {
      return icon;
    }
  }

  return '📚';
}

const DIFFICULTY_OPTIONS = [
  { value: 'EASY', label: '쉬움', color: 'text-emerald-600' },
  { value: 'MEDIUM', label: '보통', color: 'text-amber-600' },
  { value: 'HARD', label: '어려움', color: 'text-red-600' },
];

const TYPE_OPTIONS = [
  { value: 'MIX', label: '혼합' },
  { value: 'MULTIPLE', label: '객관식' },
  { value: 'SHORT', label: '주관식' },
];

const COUNT_OPTIONS = [4, 8, 10];

function createLearningSessionKey() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `learning-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function SubjectCard({ subject, isSelected, onSelect }) {
  const icon = getSubjectIcon(subject.name);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-center transition-all hover:shadow-md active:scale-95 ${
        isSelected
          ? 'border-mentor-primary bg-mentor-accent'
          : 'border-mentor-border bg-mentor-surface hover:border-mentor-primary-light'
      }`}
    >
      <span className="text-2xl" aria-hidden="true">{icon}</span>
      <span className={`text-xs font-medium ${isSelected ? 'text-mentor-primary' : 'text-mentor-text'}`}>
        {subject.name}
      </span>
    </button>
  );
}

function OptionButton({ label, isSelected, colorClass = '', onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-xl border py-2.5 text-sm font-medium transition ${
        isSelected
          ? 'border-mentor-primary bg-mentor-primary text-white'
          : `border-mentor-border bg-mentor-surface hover:border-mentor-primary-light ${colorClass || 'text-mentor-text'}`
      }`}
    >
      {label}
    </button>
  );
}
