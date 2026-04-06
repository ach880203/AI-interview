package com.aimentor.domain.profile.jobposting.dto;

import com.aimentor.domain.profile.jobposting.JobPostingEntity;

import java.time.LocalDate;
import java.time.LocalDateTime;

/** 채용공고 응답 DTO */
public record JobPostingResponseDto(
        Long id,
        Long userId,
        String company,
        String position,
        String description,
        String location,
        String fileUrl,
        String sourceUrl,
        LocalDate dueDate,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
    public static JobPostingResponseDto from(JobPostingEntity jobPosting) {
        return new JobPostingResponseDto(
                jobPosting.getId(),
                jobPosting.getUser().getId(),
                jobPosting.getCompany(),
                jobPosting.getPosition(),
                jobPosting.getDescription(),
                jobPosting.getLocation(),
                jobPosting.getFileUrl(),
                jobPosting.getSourceUrl(),
                jobPosting.getDueDate(),
                jobPosting.getCreatedAt(),
                jobPosting.getUpdatedAt()
        );
    }
}
