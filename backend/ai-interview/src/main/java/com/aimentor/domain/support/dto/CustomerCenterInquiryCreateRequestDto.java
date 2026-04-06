package com.aimentor.domain.support.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 고객센터 문의 등록 요청 DTO입니다.
 *
 * @param title 문의 제목
 * @param content 문의 내용
 */
public record CustomerCenterInquiryCreateRequestDto(
        @NotBlank(message = "문의 제목을 입력해주세요.")
        @Size(max = 120, message = "문의 제목은 120자 이하로 입력해주세요.")
        String title,

        @NotBlank(message = "문의 내용을 입력해주세요.")
        @Size(max = 5000, message = "문의 내용은 5000자 이하로 입력해주세요.")
        String content,

        /** 공개/비밀글 여부 (null이면 false 처리) */
        Boolean isPublic
) {
}
