package com.aimentor.domain.interview.dto;

import com.aimentor.domain.interview.InterviewFeedbackEntity;

import java.time.LocalDateTime;

/**
 * 면접 피드백 응답 DTO
 * POST /api/interviews/sessions/{id}/end 응답 및
 * GET  /api/interviews/sessions/{id}/feedback 응답에서 사용
 *
 * 모든 점수는 0~100 범위
 */
public record FeedbackResponseDto(
        Long id,
        Long sessionId,
        int logicScore,            // 논리성 (0~100)
        int relevanceScore,        // 관련성 (0~100)
        int specificityScore,      // 구체성 (0~100)
        int communicationScore,    // 의사소통 (0~100)
        int professionalismScore,  // 전문성 (0~100)
        int overallScore,          // 종합 점수 (0~100)
        String strengths,
        String weakPoints,
        String improvements,
        String questionFeedbacks,
        int attitudeScore,         // 면접 태도 (0~100)
        String attitudeFeedback,
        int starScore,             // STAR 기법 적용도 (0~100)
        int consistencyScore,      // 답변 일관성 (0~100)
        String consistencyFeedback,
        String recommendedAnswer,
        String timingAnalysis,
        String keywordAnalysis,
        LocalDateTime createdAt
) {
    public static FeedbackResponseDto from(InterviewFeedbackEntity feedback) {
        return new FeedbackResponseDto(
                feedback.getId(),
                feedback.getSession().getId(),
                feedback.getLogicScore(),
                feedback.getRelevanceScore(),
                feedback.getSpecificityScore(),
                feedback.getCommunicationScore(),
                feedback.getProfessionalismScore(),
                feedback.getOverallScore(),
                feedback.getStrengths(),
                feedback.getWeakPoints(),
                feedback.getImprovements(),
                feedback.getQuestionFeedbacks(),
                feedback.getAttitudeScore(),
                feedback.getAttitudeFeedback(),
                feedback.getStarScore(),
                feedback.getConsistencyScore(),
                feedback.getConsistencyFeedback(),
                feedback.getRecommendedAnswer(),
                feedback.getTimingAnalysis(),
                feedback.getKeywordAnalysis(),
                feedback.getCreatedAt()
        );
    }
}
