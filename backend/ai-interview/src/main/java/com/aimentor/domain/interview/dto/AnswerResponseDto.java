package com.aimentor.domain.interview.dto;

/**
 * 답변 제출 후 응답 DTO
 * - hasNextQuestion: 다음 질문 존재 여부
 * - nextQuestion: 다음 질문 (null이면 면접 종료 가능)
 *
 * 클라이언트 처리 예시:
 *   if (!hasNextQuestion) → "면접 종료" 버튼 활성화
 *   if (hasNextQuestion)  → nextQuestion을 화면에 표시 후 답변 녹음
 */
public record AnswerResponseDto(
        boolean hasNextQuestion,
        QaResponseDto nextQuestion  // hasNextQuestion=false이면 null
) {
    public static AnswerResponseDto withNext(QaResponseDto nextQuestion) {
        return new AnswerResponseDto(true, nextQuestion);
    }

    public static AnswerResponseDto noMore() {
        return new AnswerResponseDto(false, null);
    }
}
