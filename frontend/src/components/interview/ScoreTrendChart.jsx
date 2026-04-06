import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

/**
 * 면접 회차별 점수 추이 차트
 *
 * [역할]
 * GET /api/interviews/growth 응답의 sessions 배열을 받아
 * 종합 점수와 세부 점수 변화를 선 차트로 표시합니다.
 *
 * @param {Array}   sessions  - GrowthReportDto.SessionScoreDto 배열 (시간 오름차순)
 * @param {boolean} loading   - 로딩 상태
 */
export default function ScoreTrendChart({ sessions = [], loading = false }) {
  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <span className="h-7 w-7 animate-spin rounded-full border-4 border-mentor-accent border-t-mentor-primary" />
      </div>
    );
  }

  if (sessions.length < 2) {
    return (
      <div className="flex h-48 flex-col items-center justify-center gap-2 text-center">
        <p className="text-sm font-semibold text-mentor-text">점수 추이를 보려면 2회 이상 면접이 필요합니다.</p>
        <p className="text-xs text-mentor-muted">면접을 완료하면 여기에 차트가 표시됩니다.</p>
      </div>
    );
  }

  /** X축 레이블: "1회", "2회", ... */
  const chartData = sessions.map((s) => ({
    label: `${s.sessionNum}회`,
    sessionId: s.sessionId,
    종합: s.overallScore,
    논리성: s.logicScore,
    관련성: s.relevanceScore,
    구체성: s.specificityScore,
    의사소통: s.communicationScore,
    전문성: s.professionalismScore,
  }));

  return (
    <div className="rounded-2xl bg-mentor-surface p-6 shadow-lg">
      <h2 className="mb-1 text-base font-semibold text-mentor-text">면접 점수 추이</h2>
      <p className="mb-5 text-xs text-mentor-muted">회차별 종합 점수 및 세부 역량 변화</p>
      <div className="h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#9ca3af' }} />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
              formatter={(value, name) => [`${value}점`, name]}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line
              type="monotone"
              dataKey="종합"
              stroke="#6366f1"
              strokeWidth={2.5}
              dot={{ r: 4, fill: '#6366f1' }}
              activeDot={{ r: 6 }}
            />
            <Line type="monotone" dataKey="논리성"   stroke="#10b981" strokeWidth={1.5} dot={false} />
            <Line type="monotone" dataKey="관련성"   stroke="#f59e0b" strokeWidth={1.5} dot={false} />
            <Line type="monotone" dataKey="구체성"   stroke="#ef4444" strokeWidth={1.5} dot={false} />
            <Line type="monotone" dataKey="의사소통" stroke="#06b6d4" strokeWidth={1.5} dot={false} />
            <Line type="monotone" dataKey="전문성"   stroke="#8b5cf6" strokeWidth={1.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
