import { motion } from 'framer-motion';

/**
 * 객관식 선택지 버튼 컴포넌트
 *
 * [역할]
 * 객관식 문제의 선택지 하나를 버튼으로 표시합니다.
 * 상태(미선택/선택/정답/오답)에 따라 색상이 변경됩니다.
 *
 * [상태 전환 흐름]
 *   default   → (클릭) → selected        [답변 제출 전]
 *   selected  → (제출 후, 맞음) → correct
 *   selected  → (제출 후, 틀림) → incorrect
 *   default   → (제출 후, 정답) → correct  [사용자가 다른 것 선택했을 때 정답 강조]
 *
 * [Props]
 *   label       - 선택지 텍스트
 *   index       - 선택지 번호 (0부터 시작, ①②③④ 라벨로 변환)
 *   isSelected  - 현재 선택된 보기인지 여부
 *   isCorrect   - 제출 후: 이 보기가 정답인지 여부 (null이면 미제출 상태)
 *   isSubmitted - 답변이 제출된 상태인지 여부 (제출 후 모든 버튼 클릭 비활성화)
 *   onClick     - 선택 핸들러
 */

const CIRCLE_NUMBERS = ['①', '②', '③', '④', '⑤', '⑥'];

export default function ChoiceButton({
  label,
  index,
  isSelected,
  isCorrect,
  isSubmitted,
  onClick,
}) {
  const circleNum = CIRCLE_NUMBERS[index] ?? String(index + 1);

  function getStyle() {
    if (!isSubmitted) {
      return isSelected
        ? 'border-mentor-primary bg-mentor-accent text-mentor-text shadow-sm'
        : 'border-mentor-border bg-mentor-surface text-mentor-text hover:border-mentor-primary hover:bg-mentor-accent';
    }
    if (isCorrect) {
      return 'border-emerald-400 bg-[#E8F8F0] text-emerald-800';
    }
    if (isSelected && !isCorrect) {
      return 'border-red-400 bg-[#FEF2F2] text-red-700';
    }
    return 'border-mentor-border bg-mentor-bg text-mentor-muted';
  }

  function getIcon() {
    if (!isSubmitted) return null;
    if (isCorrect) return <span className="text-emerald-600 font-bold text-base">✓</span>;
    if (isSelected) return <span className="text-red-500 font-bold text-base">✕</span>;
    return null;
  }

  return (
    <motion.button
      onClick={onClick}
      disabled={isSubmitted}
      whileTap={!isSubmitted ? { scale: 0.98 } : {}}
      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
      className={`
        w-full flex items-center gap-3 rounded-2xl border px-4 py-3.5 text-sm
        text-left transition-all duration-150
        disabled:cursor-not-allowed
        ${getStyle()}
      `}
    >
      {/* 원형 번호 배지 */}
      <span className="flex-shrink-0 text-lg font-semibold leading-none w-6 text-center">
        {circleNum}
      </span>

      {/* 선택지 텍스트 */}
      <span className="flex-1 font-medium">{label}</span>

      {getIcon()}
    </motion.button>
  );
}
