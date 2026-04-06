package com.aimentor.domain.profile.resume.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 이력서 등록 요청 DTO
 * 파일은 multipart "file" 파트로 별도 수신
 */
public record ResumeCreateRequestDto(

        @NotBlank(message = "이력서 제목은 필수입니다.")
        @Size(max = 200, message = "제목은 200자 이하여야 합니다.")
        String title,

        String content
) {}
