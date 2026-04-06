import { motion } from 'framer-motion';

/**
 * 문제 카드 컴포넌트
 *
 * [역할]
 * 현재 학습 문제를 표시합니다.
 * 문제 유형(MULTIPLE/SHORT)에 따라 선택지 영역 또는 텍스트 입력 영역을
 * 렌더링하는 책임은 이 컴포넌트 외부(LearningSessionPage)에서 담당하고,
 * ProblemCard는 문제 헤더 + 본문만 표시합니다. (단일 책임 원칙)
 *
 * [Props]
 *   orderNum       - 현재 문제 번호 (1부터 시작)
 *   totalProblems  - 전체 문제 수
 *   type           - 'MULTIPLE' | 'SHORT' (배지 색상 분기)
 *   question       - 문제 본문 텍스트
 *   children       - 선택지(ChoiceButton 목록) 또는 텍스트 입력창
 */
export default function ProblemCard({
  orderNum,
  totalProblems,
  type,
  question,
  children,
}) {
  const typeBadge =
    type === 'MULTIPLE'
      ? { label: '객관식', cls: 'bg-mentor-accent text-mentor-primary' }
      : { label: '주관식', cls: 'bg-mentor-sky-light text-mentor-primary' };

  const progress = orderNum / totalProblems;

  return (
    <motion.div
      className="rounded-[20px] bg-mentor-surface p-8 shadow-[var(--shadow-card)]"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* 헤더: 진행 번호 + 문제 유형 배지 */}
      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm font-semibold text-mentor-primary">
          {orderNum} / {totalProblems} 문제
        </span>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${typeBadge.cls}`}>
          {typeBadge.label}
        </span>
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

      {/* 문제 본문 */}
      <div className="mb-6 flex gap-4">
        {/* Q 아이콘 — #DAEEF9 배경 */}
        <span className="flex-shrink-0 flex h-11 w-11 items-center justify-center
                         rounded-full bg-[#DAEEF9] text-sm font-bold text-mentor-primary">
          Q
        </span>
        <p className="flex-1 text-[18px] font-medium leading-relaxed text-mentor-text pt-1.5">
          {question}
        </p>
      </div>

      {/* 답변 영역 슬롯 */}
      <div>{children}</div>
    </motion.div>
  );
}
