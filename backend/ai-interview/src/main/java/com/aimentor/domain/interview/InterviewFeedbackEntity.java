package com.aimentor.domain.interview;

import com.aimentor.common.BaseTimeEntity;
import jakarta.persistence.*;
import lombok.*;

/**
 * 면접 피드백 엔티티 (interview_feedbacks 테이블)
 *
 * 관계: InterviewSessionEntity (1:1) - 세션 종료 시 1개 생성
 *
 * 점수 기준 (모두 0~100):
 * - logicScore           : 답변의 논리적 구조
 * - relevanceScore       : 질문과의 연관성
 * - specificityScore     : 구체적인 수치/사례 포함 여부
 * - communicationScore   : 의사소통 능력 (표현력·간결성·전달력)
 * - professionalismScore : 전문성 (업계 지식·기술적 깊이)
 * - overallScore         : 종합 점수 (5개 평균, 0~100)
 */
@Entity
@Table(name = "interview_feedbacks")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class InterviewFeedbackEntity extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "session_id", nullable = false, unique = true)
    private InterviewSessionEntity session;

    /** 논리성 점수 (0~100) */
    @Column(name = "logic_score", nullable = false)
    private int logicScore;

    /** 관련성 점수 (0~100) */
    @Column(name = "relevance_score", nullable = false)
    private int relevanceScore;

    /** 구체성 점수 (0~100) */
    @Column(name = "specificity_score", nullable = false)
    private int specificityScore;

    /** 의사소통 점수 (0~100) */
    @Column(name = "communication_score")
    private int communicationScore;

    /** 전문성 점수 (0~100) */
    @Column(name = "professionalism_score")
    private int professionalismScore;

    /** 종합 점수 (0~100) */
    @Column(name = "overall_score", nullable = false)
    private int overallScore;

    /** 잘한 부분 */
    @Column(name = "strengths", columnDefinition = "TEXT")
    private String strengths;

    /** 주요 약점 */
    @Column(name = "weak_points", columnDefinition = "TEXT")
    private String weakPoints;

    /** 개선 방향 */
    @Column(name = "improvements", columnDefinition = "TEXT")
    private String improvements;

    /** 질문별 상세 분석 */
    @Column(name = "question_feedbacks", columnDefinition = "TEXT")
    private String questionFeedbacks;

    /** 면접 태도 점수 (0~100): 헤징 표현 빈도, 결론 명확성 */
    @Column(name = "attitude_score")
    private int attitudeScore;

    /** 면접 태도 피드백 */
    @Column(name = "attitude_feedback", columnDefinition = "TEXT")
    private String attitudeFeedback;

    /** STAR 기법 적용도 (0~100) */
    @Column(name = "star_score")
    private int starScore;

    /** 답변 일관성 점수 (0~100) */
    @Column(name = "consistency_score")
    private int consistencyScore;

    /** 일관성 분석 피드백 */
    @Column(name = "consistency_feedback", columnDefinition = "TEXT")
    private String consistencyFeedback;

    /** AI 모범 답안 */
    @Column(name = "recommended_answer", columnDefinition = "TEXT")
    private String recommendedAnswer;

    /** 답변 시간 관리 분석 */
    @Column(name = "timing_analysis", columnDefinition = "TEXT")
    private String timingAnalysis;

    /** 채용공고 키워드 커버리지 분석 */
    @Column(name = "keyword_analysis", columnDefinition = "TEXT")
    private String keywordAnalysis;
}
