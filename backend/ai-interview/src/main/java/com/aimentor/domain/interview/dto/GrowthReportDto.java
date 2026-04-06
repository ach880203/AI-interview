package com.aimentor.domain.interview.dto;

import com.aimentor.domain.interview.InterviewFeedbackEntity;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 면접 회차별 성장 추적 응답 DTO
 * GET /api/interviews/growth
 *
 * [역할]
 * 사용자의 완료된 면접 세션 전체를 시간순으로 정렬하여
 * 회차별 점수 변화를 반환합니다.
 * 프론트엔드가 단일 API 호출로 차트를 그릴 수 있도록 설계합니다.
 *
 * [sessionNum]
 * 1부터 시작하는 면접 회차 번호 (startedAt 오름차순 기준)
 */
public record GrowthReportDto(
        List<SessionScoreDto> sessions
) {

    /**
     * 한 회차의 면접 점수 스냅샷
     *
     * @param sessionId            세션 ID (결과 페이지 이동에 사용)
     * @param sessionNum           회차 번호 (1·2·3...)
     * @param overallScore         종합 점수 (0~100)
     * @param logicScore           논리성 (0~100)
     * @param relevanceScore       관련성 (0~100)
     * @param specificityScore     구체성 (0~100)
     * @param communicationScore   의사소통 (0~100)
     * @param professionalismScore 전문성 (0~100)
     * @param attitudeScore        면접 태도 (0~100)
     * @param starScore            STAR 기법 (0~100)
     * @param consistencyScore     일관성 (0~100)
     * @param completedAt          면접 종료 시각
     */
    public record SessionScoreDto(
            Long sessionId,
            int sessionNum,
            int overallScore,
            int logicScore,
            int relevanceScore,
            int specificityScore,
            int communicationScore,
            int professionalismScore,
            int attitudeScore,
            int starScore,
            int consistencyScore,
            LocalDateTime completedAt
    ) {
        public static SessionScoreDto from(InterviewFeedbackEntity feedback, int sessionNum) {
            return new SessionScoreDto(
                    feedback.getSession().getId(),
                    sessionNum,
                    feedback.getOverallScore(),
                    feedback.getLogicScore(),
                    feedback.getRelevanceScore(),
                    feedback.getSpecificityScore(),
                    feedback.getCommunicationScore(),
                    feedback.getProfessionalismScore(),
                    feedback.getAttitudeScore(),
                    feedback.getStarScore(),
                    feedback.getConsistencyScore(),
                    feedback.getSession().getEndedAt()
            );
        }
    }
}
