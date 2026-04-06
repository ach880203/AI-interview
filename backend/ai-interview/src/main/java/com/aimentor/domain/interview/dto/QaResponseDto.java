package com.aimentor.domain.interview.dto;

import com.aimentor.domain.interview.InterviewQaEntity;

import java.time.LocalDateTime;

/**
 * Q&A 단건 응답 DTO
 * 질문 생성 직후: answerText=null, audioUrl=null
 * 답변 제출 후: answerText, audioUrl 채워짐
 */
public record QaResponseDto(
        Long id,
        int orderNum,
        String question,
        String answerText,
        String audioUrl,
        LocalDateTime createdAt
) {
    public static QaResponseDto from(InterviewQaEntity qa) {
        return new QaResponseDto(
                qa.getId(),
                qa.getOrderNum(),
                qa.getQuestion(),
                qa.getAnswerText(),
                qa.getAudioUrl(),
                qa.getCreatedAt()
        );
    }
}
