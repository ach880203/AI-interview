package com.aimentor.domain.interview.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/**
 * 답변 제출 요청 DTO
 * - orderNum: 현재 답변하는 질문의 순서 (1부터 시작)
 * - answerText: STT 변환된 텍스트 답변 (필수)
 * - audioUrl: S3에 업로드된 음성 파일 URL (선택, TODO: 실제 STT 연동)
 */
public record AnswerSubmitRequestDto(

        @NotNull(message = "질문 순서(orderNum)는 필수입니다.")
        @Min(value = 1, message = "orderNum은 1 이상이어야 합니다.")
        Integer orderNum,

        @NotBlank(message = "답변 내용은 필수입니다.")
        String answerText,

        String audioUrl,       // S3 URL placeholder (선택)
        Integer answerDuration // 녹음 시간 (초 단위, 음성 모드에서만 전달)
) {}
