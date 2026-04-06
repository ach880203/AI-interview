/**
 * 재사용 Input 컴포넌트
 *
 * [Props]
 *   label       - 입력 필드 위에 표시되는 레이블 텍스트
 *   id          - <label>과 <input>을 연결하는 HTML id (스크린리더 접근성)
 *   error       - 유효성 검사 실패 시 표시할 오류 메시지.
 *                 값이 있으면 빨간 테두리 + 오류 문구 표시
 *   hint        - error 없을 때 표시할 보조 안내 텍스트 (선택)
 *   className   - 추가 Tailwind 클래스 (외부에서 너비 등 오버라이드)
 *   ...rest     - type, value, onChange, placeholder 등 <input> 네이티브 속성 전달
 *
 * [디자인 원칙]
 *   - 테두리: mentor-border (연한 회색 #E2E8F0)
 *   - 포커스: mentor-primary 테두리 + mentor-accent 링 (파란 계열)
 *   - 오류 상태: mentor-danger 테두리 + 빨간 링
 *   - 비활성화: 배경 mentor-bg + opacity 0.6
 */
export default function Input({ label, id, error, hint, className = '', ...rest }) {
  return (
    <div className="flex flex-col gap-1.5">
      {/* 레이블 — for 속성(htmlFor)으로 input과 연결 */}
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-mentor-text">
          {label}
        </label>
      )}

      <input
        id={id}
        className={`
          w-full rounded-xl border px-3.5 py-2.5 text-sm text-mentor-text
          bg-mentor-surface outline-none transition-all duration-150
          placeholder:text-mentor-muted/60
          focus:ring-2 focus:ring-offset-1
          disabled:cursor-not-allowed disabled:bg-mentor-bg disabled:opacity-60
          ${error
            /* 오류 상태: 빨간 테두리 + 빨간 포커스 링 */
            ? 'border-mentor-danger focus:border-mentor-danger focus:ring-red-200'
            /* 정상 상태: 회색 테두리 → 포커스 시 파란 테두리 + 연한 파란 링 */
            : 'border-mentor-border focus:border-mentor-primary focus:ring-mentor-accent'
          }
          ${className}
        `}
        {...rest}
      />

      {/* 오류 메시지 — 빨간 소문자 */}
      {error && (
        <p className="text-xs text-mentor-danger" role="alert">{error}</p>
      )}

      {/* 힌트 텍스트 — error 없을 때만 보조 안내 표시 */}
      {!error && hint && (
        <p className="text-xs text-mentor-muted">{hint}</p>
      )}
    </div>
  );
}
