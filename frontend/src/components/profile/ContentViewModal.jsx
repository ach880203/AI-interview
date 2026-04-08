import { useEffect } from 'react';

/**
 * 이력서/자기소개서 전체 내용 보기 모달
 *
 * @param {string} title - 문서 제목
 * @param {string} content - 문서 전체 내용
 * @param {string|null} originalFileName - 업로드한 원본 파일명
 * @param {string|null} fileUrl - 첨부 파일 URL (없으면 null)
 * @param {() => void} onClose - 모달 닫기 핸들러
 */
export default function ContentViewModal({ title, content, originalFileName, fileUrl, onClose }) {
  // ESC 키로 닫기
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[80vh] w-full max-w-2xl flex-col rounded-2xl bg-mentor-surface shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-start justify-between gap-4 border-b border-mentor-border px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-mentor-muted">내용 전체 보기</p>
            <h2 className="mt-1 text-lg font-bold text-mentor-text">{title}</h2>
            {originalFileName && (
              <div className="mt-1.5 flex items-center gap-1.5">
                <svg className="h-3.5 w-3.5 shrink-0 text-mentor-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                <span className="text-xs text-mentor-muted">{originalFileName}</span>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-mentor-muted transition hover:bg-mentor-bg hover:text-mentor-text"
            aria-label="닫기"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 내용 (스크롤) */}
        <div className="overflow-y-auto px-6 py-5">
          <p className="whitespace-pre-wrap text-sm leading-7 text-mentor-text">
            {content}
          </p>
        </div>

        {/* 하단 — 파일 링크 + 닫기 */}
        <div className="flex items-center justify-between gap-3 border-t border-mentor-border px-6 py-4">
          <div>
            {fileUrl && (
              <a
                href={fileUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-medium text-mentor-primary hover:text-mentor-primary-dark"
              >
                첨부 파일 보기
              </a>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-mentor-bg px-4 py-2 text-sm font-medium text-mentor-text transition hover:bg-mentor-accent"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
