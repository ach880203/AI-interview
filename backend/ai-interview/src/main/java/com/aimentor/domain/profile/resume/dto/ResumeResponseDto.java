package com.aimentor.domain.profile.resume.dto;

import com.aimentor.domain.profile.resume.ResumeEntity;

import java.time.LocalDateTime;

/**
 * 이력서 응답 DTO
 * user 엔티티 대신 userId만 노출 (순환 참조 방지, 불필요한 정보 차단)
 */
public record ResumeResponseDto(
        Long id,
        Long userId,
        String title,
        String content,
        String fileUrl,
        String originalFileName,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
    public static ResumeResponseDto from(ResumeEntity resume) {
        return new ResumeResponseDto(
                resume.getId(),
                resume.getUser().getId(),
                resume.getTitle(),
                resume.getContent(),
                resume.getFileUrl(),
                resume.getOriginalFileName(),
                resume.getCreatedAt(),
                resume.getUpdatedAt()
        );
    }
}
