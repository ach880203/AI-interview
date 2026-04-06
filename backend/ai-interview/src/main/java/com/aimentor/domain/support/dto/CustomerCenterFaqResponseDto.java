package com.aimentor.domain.support.dto;

import com.aimentor.domain.support.CustomerCenterFaqEntity;

import java.time.LocalDateTime;

/**
 * FAQ 응답 DTO입니다.
 *
 * [역할]
 * 사용자 고객센터 화면과 관리자 FAQ 관리 화면에서 같은 구조를 재사용합니다.
 */
public record CustomerCenterFaqResponseDto(
        Long id,
        String category,
        String question,
        String answer,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
    public static CustomerCenterFaqResponseDto from(CustomerCenterFaqEntity faq) {
        return new CustomerCenterFaqResponseDto(
                faq.getId(),
                faq.getCategory(),
                faq.getQuestion(),
                faq.getAnswer(),
                faq.getCreatedAt(),
                faq.getUpdatedAt()
        );
    }
}
