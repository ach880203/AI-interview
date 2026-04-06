package com.aimentor.domain.profile.jobposting.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * 채용공고 URL 등록 요청 DTO
 *
 * [역할]
 * POST /api/job-postings/from-url 요청 바디를 받습니다.
 * Python AI 서버가 URL을 스크래핑해 company/position/description을 자동 추출합니다.
 */
public record JobPostingUrlRequestDto(

        @NotBlank(message = "URL은 필수입니다.")
        String url
) {}
