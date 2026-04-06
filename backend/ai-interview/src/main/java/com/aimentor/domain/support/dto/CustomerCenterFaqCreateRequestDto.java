package com.aimentor.domain.support.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * FAQ 등록 요청 DTO입니다.
 *
 * @param category FAQ 분류
 * @param question 질문
 * @param answer 답변
 */
public record CustomerCenterFaqCreateRequestDto(
        @NotBlank(message = "FAQ 분류를 입력해주세요.")
        @Size(max = 60, message = "FAQ 분류는 60자 이하로 입력해주세요.")
        String category,

        @NotBlank(message = "FAQ 질문을 입력해주세요.")
        @Size(max = 255, message = "FAQ 질문은 255자 이하로 입력해주세요.")
        String question,

        @NotBlank(message = "FAQ 답변을 입력해주세요.")
        @Size(max = 5000, message = "FAQ 답변은 5000자 이하로 입력해주세요.")
        String answer
) {
}
