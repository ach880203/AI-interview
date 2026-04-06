import { motion } from 'framer-motion';

/**
 * 면접 질문 카드 컴포넌트
 *
 * [역할]
 * 현재 AI 면접 질문을 크게 표시하고, 진행률(orderNum / totalQuestions)을 보여줍니다.
 *
 * [Props]
 *   question       - 표시할 질문 텍스트
 *   orderNum       - 현재 질문 번호 (1부터 시작)
 *   totalQuestions - 전체 질문 수 (기본 5)
 *   isSpeaking     - TTS 음성 출력 중 여부 (애니메이션 표시)
 */
export default function QuestionCard({
  question,
  orderNum,
  totalQuestions = 5,
  isSpeaking = false,
}) {
  const progress = orderNum / totalQuestions;

  return (
    <motion.div
      className="rounded-[20px] bg-mentor-surface p-8 shadow-[var(--shadow-card)]"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* 진행률 헤더 */}
      <div className="mb-5 flex items-center justify-between">
        <span className="text-sm font-semibold text-mentor-primary">
          질문 {orderNum} / {totalQuestions}
        </span>

        {isSpeaking && (
          <span className="flex items-center gap-1.5 rounded-full bg-mentor-accent px-3 py-1 text-xs font-medium text-mentor-primary">
            <span className="flex items-end gap-0.5 h-3.5">
              <span className="w-0.5 bg-mentor-primary rounded-full animate-bounce" style={{ height: '55%', animationDelay: '0ms' }} />
              <span className="w-0.5 bg-mentor-primary rounded-full animate-bounce" style={{ height: '100%', animationDelay: '150ms' }} />
              <span className="w-0.5 bg-mentor-primary rounded-full animate-bounce" style={{ height: '40%', animationDelay: '300ms' }} />
            </span>
            AI 음성 출력 중
          </span>
        )}
      </div>

      {/* 진행 바 */}
      <div className="mb-7 h-1.5 w-full overflow-hidden rounded-full bg-mentor-bg">
        <motion.div
          className="h-full rounded-full bg-mentor-primary"
          initial={{ width: 0 }}
          animate={{ width: `${progress * 100}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>

      {/* 질문 텍스트 */}
      <div className="flex gap-4">
        {/* Q 아이콘 — #DAEEF9 배경 */}
        <div className="flex-shrink-0 w-11 h-11 rounded-full bg-[#DAEEF9] flex items-center justify-center">
          <span className="text-mentor-primary font-bold text-sm">Q</span>
        </div>

        <p className="flex-1 text-[18px] font-medium leading-relaxed text-mentor-text pt-1.5">
          {question ?? '질문을 불러오는 중...'}
        </p>
      </div>
    </motion.div>
  );
}
