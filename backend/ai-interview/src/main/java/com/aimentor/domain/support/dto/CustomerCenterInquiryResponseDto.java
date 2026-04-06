package com.aimentor.domain.support.dto;

import com.aimentor.domain.support.CustomerCenterInquiryEntity;

import java.time.LocalDateTime;

/**
 * 고객센터 문의 응답 DTO입니다.
 *
 * [역할]
 * 사용자 화면과 관리자 화면이 같은 데이터를 보되,
 * 화면에서 바로 쓸 수 있게 상태 코드와 한글 상태명을 함께 제공합니다.
 */
public record CustomerCenterInquiryResponseDto(
        Long id,
        String title,
        String content,
        String reply,
        boolean answered,
        String status,
        String statusCode,
        String userName,
        String userEmail,
        boolean isPublic,
        int helpfulCount,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        LocalDateTime answeredAt
) {
    public static CustomerCenterInquiryResponseDto from(CustomerCenterInquiryEntity inquiry) {
        return new CustomerCenterInquiryResponseDto(
                inquiry.getId(),
                inquiry.getTitle(),
                inquiry.getContent(),
                inquiry.getReply(),
                inquiry.getStatus() == CustomerCenterInquiryEntity.InquiryStatus.ANSWERED,
                inquiry.getStatus().getLabel(),
                inquiry.getStatus().name(),
                inquiry.getUser().getName(),
                inquiry.getUser().getEmail(),
                inquiry.isPublic(),
                inquiry.getHelpfulCount(),
                inquiry.getCreatedAt(),
                inquiry.getUpdatedAt(),
                inquiry.getAnsweredAt()
        );
    }
}
