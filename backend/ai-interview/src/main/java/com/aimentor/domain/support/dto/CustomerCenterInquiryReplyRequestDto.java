package com.aimentor.domain.support.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 관리자 문의 답변 요청 DTO입니다.
 *
 * @param reply 관리자 답변 내용
 */
public record CustomerCenterInquiryReplyRequestDto(
        @NotBlank(message = "답변 내용을 입력해주세요.")
        @Size(max = 5000, message = "답변 내용은 5000자 이하로 입력해주세요.")
        String reply
) {
}
