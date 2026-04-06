package com.aimentor.domain.profile.coverletter.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** 자기소개서 수정 요청 DTO */
public record CoverLetterUpdateRequestDto(

        @NotBlank(message = "자기소개서 제목은 필수입니다.")
        @Size(max = 200, message = "제목은 200자 이하여야 합니다.")
        String title,

        String content
) {}
