package com.aimentor.external.ai.dto;

/**
 * AI 면접 피드백 결과 DTO
 *
 * [역할]
 * Python AI 서버(/interview/feedback)가 반환한 면접 평가 데이터를
 * Spring Boot 내부에서 주고받을 때 사용하는 DTO입니다.
 *
 * [사용 흐름]
 * PythonAiService.generateFeedback()
 *   → FeedbackDto (이 클래스)
 *     → InterviewService.endSession()
 *       → InterviewFeedbackEntity (DB 저장)
 *         → FeedbackResponseDto (API 응답)
 *
 * [각 점수 의미 — 모두 0~100]
 * - logicScore           : 논리성 — 답변의 구조와 논리적 흐름
 * - relevanceScore       : 관련성 — 질문과 답변의 연관도
 * - specificityScore     : 구체성 — 수치·사례 등 구체적 근거 포함 여부
 * - communicationScore   : 의사소통 — 표현의 간결성·명료성·전달력
 * - professionalismScore : 전문성 — 업계 지식·기술적 깊이·문제 해결 성숙도
 * - overallScore         : 종합 점수 — 5개 항목의 평균
 */
public record FeedbackDto(

        /** 논리성 점수 (0~100) */
        int logicScore,

        /** 관련성 점수 (0~100) */
        int relevanceScore,

        /** 구체성 점수 (0~100) */
        int specificityScore,

        /** 의사소통 점수 (0~100) */
        int communicationScore,

        /** 전문성 점수 (0~100) */
        int professionalismScore,

        /** 종합 점수 (0~100) */
        int overallScore,

        /** 잘한 부분 */
        String strengths,

        /** 약점 설명 */
        String weakPoints,

        /** 개선 제안 */
        String improvements,

        /** 질문별 상세 분석 */
        String questionFeedbacks,

        /** 면접 태도 점수 (0~100): 헤징 표현 빈도, 결론 명확성 */
        int attitudeScore,

        /** 면접 태도 피드백 */
        String attitudeFeedback,

        /** STAR 기법 적용도 (0~100) */
        int starScore,

        /** 답변 일관성 점수 (0~100): 사실 정보 모순 여부 */
        int consistencyScore,

        /** 일관성 분석 피드백 */
        String consistencyFeedback,

        /** 모범 답안 */
        String recommendedAnswer,

        /** 답변 시간 관리 분석 */
        String timingAnalysis,

        /** 채용공고 키워드 커버리지 분석 */
        String keywordAnalysis

) {}
