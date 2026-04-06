package com.aimentor.domain.learning;

import com.aimentor.common.BaseTimeEntity;
import com.aimentor.domain.user.UserEntity;
import jakarta.persistence.*;
import lombok.*;

/**
 * 사용자의 학습 답안 제출 기록을 저장하는 엔티티입니다.
 *
 * [역할]
 * 문제별 정답 여부와 AI 피드백을 남겨 두고,
 * 이후 대시보드와 학습 통계에서 사용자별 학습 이력을 집계할 수 있게 합니다.
 */
@Entity
@Table(
        name = "learning_attempts",
        indexes = {
                // 사용자별 학습 통계 조회 시 최신순 정렬에 사용 (getStats, getAnalytics, getRecommendation)
                @Index(name = "idx_learning_attempts_user_created", columnList = "user_id, created_at DESC"),
                // 오답 필터링 조회 (getWrongAttempts)
                @Index(name = "idx_learning_attempts_user_correct", columnList = "user_id, is_correct"),
                // 같은 학습 세션으로 묶인 결과를 빠르게 복원하기 위한 인덱스입니다.
                @Index(name = "idx_learning_attempts_user_session", columnList = "user_id, session_key")
        }
)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class LearningAttemptEntity extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * 이 학습 시도를 수행한 사용자입니다.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private UserEntity user;

    /**
     * 프런트 학습 한 번을 구분하는 세션 키입니다.
     * 별도 학습 세션 엔티티를 크게 추가하지 않고도
     * 부분 완료 결과를 묶어서 다시 읽기 위한 최소 기준값입니다.
     */
    @Column(name = "session_key", length = 120)
    private String sessionKey;

    /**
     * 이 세션에서 원래 몇 문제를 풀 계획이었는지 저장합니다.
     * 부분 완료 결과와 전체 완료 결과를 구분할 때 사용합니다.
     */
    @Column(name = "session_problem_count")
    private Integer sessionProblemCount;

    /**
     * 현재 제출한 답안이 세션 내 몇 번째 문제였는지 저장합니다.
     * 결과 요약을 문제 순서대로 다시 보여주기 위해 필요합니다.
     */
    @Column(name = "session_problem_order")
    private Integer sessionProblemOrder;

    /**
     * 학습 시도가 속한 과목입니다.
     * 예전 데이터나 비정상 요청까지 수용할 수 있도록 nullable로 둡니다.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "subject_id")
    private LearningSubjectEntity subject;

    /**
     * 문제 생성 시 선택한 난이도입니다.
     */
    @Column(length = 20)
    private String difficulty;

    /**
     * 문제 유형입니다. 예: MULTIPLE, SHORT
     */
    @Column(name = "problem_type", length = 20)
    private String problemType;

    /**
     * 사용자가 풀었던 문제 본문입니다.
     */
    @Column(columnDefinition = "TEXT", nullable = false)
    private String question;

    /**
     * 정답 저장용 필드입니다.
     */
    @Column(name = "correct_answer", columnDefinition = "TEXT", nullable = false)
    private String correctAnswer;

    /**
     * 사용자가 제출한 답안입니다.
     */
    @Column(name = "user_answer", columnDefinition = "TEXT", nullable = false)
    private String userAnswer;

    /**
     * AI가 반환한 채점 피드백입니다.
     */
    @Column(name = "ai_feedback", columnDefinition = "TEXT")
    private String aiFeedback;

    /**
     * 정답 여부입니다.
     */
    @Column(name = "is_correct", nullable = false)
    private boolean isCorrect;

    /**
     * 학습 통계 계산에서 읽기 쉬운 형태로 정답 여부를 제공합니다.
     *
     * @return 정답이면 true
     */
    public boolean isCorrect() {
        return isCorrect;
    }
}
