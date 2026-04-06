import { useState } from 'react';

/**
 * 피드백 텍스트 카드 컴포넌트
 *
 * [역할]
 * 면접 피드백의 세 영역(약점 / 개선 방향 / 추천 답변)을
 * 컬러 코딩된 카드로 표시합니다.
 * collapsible=true 시 미리보기(PREVIEW_LENGTH자)로 축약 표시 후
 * "더 보기" / "접기" 버튼으로 전체 내용을 토글합니다.
 *
 * [Props]
 *   title          - 카드 제목 (예: "부족한 부분")
 *   content        - 표시할 본문 텍스트
 *   variant        - 'danger' | 'warning' | 'success' | 'info'
 *                    각각 빨강·노랑·초록·파랑 계열 색상 적용
 *   icon           - 제목 앞에 표시할 이모지 또는 텍스트 (선택)
 *   collapsible    - true이면 접기/펼치기 기능 활성화 (기본 false)
 *   defaultExpanded - 초기 펼침 여부 (기본 false)
 */
export default function FeedbackCard({
  title,
  content,
  variant = 'info',
  icon,
  collapsible = false,
  defaultExpanded = false,
}) {
  // collapsible 모드에서 현재 펼침 상태
  const [expanded, setExpanded] = useState(defaultExpanded);

  /**
   * variant별 Tailwind 클래스 매핑
   * 배경(bg) + 테두리(border) + 제목색(heading) + 본문색(text)
   */
  const variantClasses = {
    danger: {
      wrapper: 'bg-red-50 border-red-200',
      heading: 'text-red-700',
      body: 'text-red-800',
      toggle: 'text-red-600 hover:text-red-800',
      divider: 'border-red-200',
    },
    warning: {
      wrapper: 'bg-amber-50 border-amber-200',
      heading: 'text-amber-700',
      body: 'text-amber-800',
      toggle: 'text-amber-600 hover:text-amber-800',
      divider: 'border-amber-200',
    },
    success: {
      wrapper: 'bg-emerald-50 border-emerald-200',
      heading: 'text-emerald-700',
      body: 'text-emerald-800',
      toggle: 'text-emerald-600 hover:text-emerald-800',
      divider: 'border-emerald-200',
    },
    info: {
      wrapper: 'bg-blue-50 border-blue-200',
      heading: 'text-blue-700',
      body: 'text-blue-800',
      toggle: 'text-blue-600 hover:text-blue-800',
      divider: 'border-blue-200',
    },
  };

  const cls = variantClasses[variant] ?? variantClasses.info;

  /** 미리보기 글자 수 기준 — 이 이상이면 "더 보기" 버튼 표시 */
  const PREVIEW_LENGTH = 120;

  /**
   * 표시할 텍스트를 결정합니다.
   * - collapsible이 아니거나 접힌 내용이 PREVIEW_LENGTH 이하면 전체 표시
   * - collapsible이고 접힌 상태면 첫 PREVIEW_LENGTH자 + "..."
   */
  const isLong = collapsible && (content?.length ?? 0) > PREVIEW_LENGTH;
  const displayText = isLong && !expanded
    ? content.slice(0, PREVIEW_LENGTH).trimEnd() + '...'
    : content;

  return (
    <div className={`rounded-xl border ${cls.wrapper}`}>
      {/* ── 카드 헤더 ── */}
      <button
        type="button"
        onClick={() => collapsible && setExpanded((prev) => !prev)}
        className={`w-full flex items-center justify-between p-5 text-left ${collapsible ? 'cursor-pointer' : 'cursor-default'}`}
      >
        <h3 className={`flex items-center gap-2 text-sm font-semibold ${cls.heading}`}>
          {icon && <span aria-hidden="true">{icon}</span>}
          {title}
        </h3>

        {/* 접기/펼치기 아이콘 — collapsible 모드에서만 표시 */}
        {collapsible && (
          <span className={`text-xs font-medium transition-transform ${cls.toggle}`}>
            {expanded ? '▲ 접기' : '▼ 펼치기'}
          </span>
        )}
      </button>

      {/* ── 본문 구역 ── */}
      <div className={`px-5 pb-5 ${collapsible ? `border-t pt-4 ${cls.divider}` : ''}`}>
        {/* 본문 — 줄바꿈 보존 */}
        <p className={`text-sm leading-relaxed whitespace-pre-line ${cls.body}`}>
          {displayText || '내용이 없습니다.'}
        </p>

        {/* 긴 내용일 때만 "더 보기 / 접기" 인라인 버튼 표시 */}
        {isLong && (
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className={`mt-3 text-xs font-semibold underline underline-offset-2 transition ${cls.toggle}`}
          >
            {expanded ? '접기' : '더 보기'}
          </button>
        )}
      </div>
    </div>
  );
}
