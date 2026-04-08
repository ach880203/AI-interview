import { useNavigate } from 'react-router-dom';

/**
 * 일일 무료 사용 횟수 초과 안내 배너
 *
 * [역할]
 * 비구독자가 하루 1회 무료 사용 횟수를 모두 소진했을 때 표시합니다.
 * 구독 페이지로 이동하는 버튼을 함께 제공합니다.
 *
 * @param {string} featureName - 제한된 기능 이름 (예: '면접', '학습')
 */
export default function UsageLimitBanner({ featureName }) {
  const navigate = useNavigate();

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-amber-800">
            오늘의 무료 {featureName} 횟수를 모두 사용했습니다.
          </p>
          <p className="mt-1 text-xs text-amber-700">
            구독하면 {featureName}을 하루, 1주일, 1개월, 1년 단위로 무제한 이용할 수 있습니다.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/subscription')}
          className="shrink-0 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-600 active:scale-95"
        >
          구독하기
        </button>
      </div>
    </div>
  );
}
