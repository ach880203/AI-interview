import { useEffect, useRef, useState } from 'react';

const introVideoSource = '/intro.mp4';

const INTRO_FADE_OUT_DURATION = 500;

/**
 * 인트로 영상 오버레이 컴포넌트
 *
 * 사용자가 첫 진입했을 때만 전체 화면으로 영상을 보여 주고,
 * 영상 종료/화면 클릭/건너뛰기 버튼을 모두 같은 종료 흐름으로 묶습니다.
 * 이렇게 한 곳에서 종료를 관리하면 페이드아웃 타이밍과 세션 저장 처리가 어긋나지 않습니다.
 */
export default function IntroVideo({ onComplete }) {
  const [isClosing, setIsClosing] = useState(false);
  const closeTimerRef = useRef(null);
  const hasRequestedCloseRef = useRef(false);

  /**
   * 종료 요청이 여러 번 들어와도 한 번만 처리합니다.
   * 영상 `onEnded`와 버튼 클릭이 거의 동시에 들어올 수 있어서 중복 호출 방지가 필요합니다.
   */
  const requestClose = () => {
    if (hasRequestedCloseRef.current) return;

    hasRequestedCloseRef.current = true;
    setIsClosing(true);

    closeTimerRef.current = window.setTimeout(() => {
      onComplete?.();
    }, INTRO_FADE_OUT_DURATION);
  };

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  return (
    <div
      className={`fixed inset-0 z-[9999] overflow-hidden bg-slate-950 transition-opacity duration-500 ${isClosing ? 'opacity-0' : 'opacity-100'}`}
      onClick={requestClose}
    >
      <video
        className="h-full w-full object-cover"
        src={introVideoSource}
        autoPlay
        muted
        playsInline
        preload="auto"
        onEnded={requestClose}
        onError={requestClose}
      />

      {/* 밝은 영상에서도 버튼이 읽히도록 하단에 은은한 그라데이션을 깔아 둡니다. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-slate-950/65 via-slate-950/20 to-transparent" />

      <button
        type="button"
        className="absolute bottom-6 right-6 rounded-full border border-white/35 bg-white/20 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-black/15 backdrop-blur-md transition hover:bg-white/30 focus:outline-none focus:ring-2 focus:ring-white/80 focus:ring-offset-2 focus:ring-offset-slate-900"
        onClick={(event) => {
          event.stopPropagation();
          requestClose();
        }}
        aria-label="인트로 영상을 건너뛰고 메인 화면으로 이동"
      >
        건너뛰기 &gt;
      </button>
    </div>
  );
}
