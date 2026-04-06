package com.aimentor.domain.profile.jobposting.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

/** 채용공고 수정 요청 DTO */
public record JobPostingUpdateRequestDto(

        @NotBlank(message = "회사명은 필수입니다.")
        @Size(max = 100, message = "회사명은 100자 이하여야 합니다.")
        String company,

        @NotBlank(message = "포지션은 필수입니다.")
        @Size(max = 200, message = "포지션은 200자 이하여야 합니다.")
        String position,

        String description,

        String location,

        LocalDate dueDate
) {}
