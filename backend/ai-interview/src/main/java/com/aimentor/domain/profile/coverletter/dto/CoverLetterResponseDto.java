package com.aimentor.domain.profile.coverletter.dto;

import com.aimentor.domain.profile.coverletter.CoverLetterEntity;

import java.time.LocalDateTime;

/** 자기소개서 응답 DTO */
public record CoverLetterResponseDto(
        Long id,
        Long userId,
        String title,
        String content,
        String fileUrl,
        String originalFileName,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
    public static CoverLetterResponseDto from(CoverLetterEntity coverLetter) {
        return new CoverLetterResponseDto(
                coverLetter.getId(),
                coverLetter.getUser().getId(),
                coverLetter.getTitle(),
                coverLetter.getContent(),
                coverLetter.getFileUrl(),
                coverLetter.getOriginalFileName(),
                coverLetter.getCreatedAt(),
                coverLetter.getUpdatedAt()
        );
    }
}
