import { motion, AnimatePresence } from 'framer-motion';

/**
 * AI 채점 피드백 팝업 컴포넌트
 *
 * [역할]
 * 답변 제출 후 정오답 결과와 AI 피드백을 모달 형태로 표시합니다.
 * 화면을 반투명 오버레이로 덮고, 피드백 카드를 아래에서 슬라이드업으로 띄웁니다.
 *
 * [Props]
 *   isOpen        - 팝업 표시 여부
 *   isCorrect     - 정답(true) / 오답(false)
 *   correctAnswer - 정답 텍스트 (오답일 때 표시)
 *   aiFeedback    - AI 피드백 텍스트
 *   isLast        - 마지막 문제 여부 (버튼 텍스트 분기)
 *   onNext        - "다음 문제" / "결과 보기" 클릭 핸들러
 */
export default function FeedbackPopup({
  isOpen,
  isCorrect,
  correctAnswer,
  aiFeedback,
  isLast,
  onNext,
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pb-6
                      sm:items-center sm:pb-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="w-full max-w-lg rounded-[20px] bg-white shadow-2xl overflow-hidden"
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 30, opacity: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* 정오답 헤더 — 밝은 파스텔 배경 */}
            <div className={`px-6 py-5 ${isCorrect ? 'bg-[#E8F8F0]' : 'bg-[#FEF2F2]'}`}>
              <div className="flex items-center gap-3">
                <span className="text-2xl" aria-hidden="true">
                  {isCorrect ? '🎉' : '😅'}
                </span>
                <div>
                  <p className={`text-base font-bold ${isCorrect ? 'text-emerald-700' : 'text-red-600'}`}>
                    {isCorrect ? '정답입니다!' : '오답입니다.'}
                  </p>
                  <p className={`text-xs mt-0.5 ${isCorrect ? 'text-emerald-600' : 'text-red-500'}`}>
                    {isCorrect ? '훌륭해요! AI 해설을 확인해보세요.' : '다음에 도전해보세요!'}
                  </p>
                </div>
              </div>
            </div>

            {/* 본문 */}
            <div className="px-6 py-5 flex flex-col gap-4">

              {/* 오답일 때 정답 표시 */}
              {!isCorrect && correctAnswer && (
                <div className="rounded-2xl bg-[#E8F8F0] border border-emerald-200 px-4 py-3">
                  <p className="text-xs font-semibold text-emerald-700 mb-1">정답</p>
                  <p className="text-sm text-emerald-800">{correctAnswer}</p>
                </div>
              )}

              {/* AI 피드백 */}
              <div className="rounded-2xl bg-mentor-accent border border-mentor-primary/20 px-4 py-4">
                <p className="text-xs font-semibold text-mentor-primary mb-2">💡 AI 해설</p>
                <p className="text-sm text-mentor-text leading-relaxed whitespace-pre-line">
                  {aiFeedback || '해설을 불러오는 중...'}
                </p>
              </div>

              {/* 다음 문제 / 결과 보기 버튼 */}
              <button
                onClick={onNext}
                className="w-full rounded-2xl bg-mentor-primary py-3.5 text-sm font-semibold text-white
                           hover:bg-mentor-primary-dark active:scale-95 transition"
              >
                {isLast ? '결과 보기 →' : '다음 문제 →'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
