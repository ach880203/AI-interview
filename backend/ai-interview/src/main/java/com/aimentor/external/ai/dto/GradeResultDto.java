package com.aimentor.external.ai.dto;

/**
 * AI 학습 채점 결과 DTO
 *
 * [역할]
 * Python AI 서버(/learning/grade)가 반환한 채점 결과를
 * Spring Boot 내부에서 주고받을 때 사용하는 DTO입니다.
 *
 * [사용 흐름]
 * PythonAiService.gradeLearningAnswer()
 *   → GradeResultDto (이 클래스)
 *     → LearningService.gradeAttempt()
 *       → LearningAttemptEntity (DB 저장)
 *         → LearningAttemptResponseDto (API 응답)
 *
 * [필드 설명]
 * - correct       : 정답 여부 (true = 정답)
 * - score         : 점수 (Python은 score를 반환하지 않아 PythonAiService는 0으로 설정,
 *                   MockAiService는 정답이면 80 / 오답이면 40을 사용)
 * - feedback      : AI가 작성한 피드백 텍스트 (왜 맞았는지/틀렸는지 설명)
 * - correctAnswer : 정답 문자열 (프론트엔드 결과 화면에 보여줄 용도)
 *
 * [왜 record를 사용하는가]
 * 채점 결과는 생성 후 변경할 필요가 없는 불변 데이터입니다.
 * record를 사용하면 getter(필드명으로 직접 접근), equals, toString을 자동으로 생성합니다.
 *
 * [사용 예시]
 * GradeResultDto result = aiService.gradeLearningAnswer(...);
 * result.correct()       // true / false
 * result.feedback()      // "핵심 개념을 잘 설명했습니다..."
 * result.correctAnswer() // "정답 문자열"
 */
public record GradeResultDto(

        /** 정답 여부: true = 정답, false = 오답 */
        boolean correct,

        /**
         * 점수 (0~100).
         * Python AI 채점 서버는 점수를 반환하지 않아 PythonAiService에서 0으로 고정됩니다.
         * MockAiService에서는 정답=80, 오답=40을 사용합니다.
         */
        int score,

        /** AI 피드백: 왜 맞았는지 또는 어떤 점이 부족한지에 대한 설명 */
        String feedback,

        /** 정답 문자열: 프론트엔드 결과 화면에 보여줄 용도 */
        String correctAnswer

) {}
