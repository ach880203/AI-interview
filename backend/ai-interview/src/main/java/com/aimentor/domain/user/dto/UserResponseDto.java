package com.aimentor.domain.user.dto;

import com.aimentor.domain.user.UserEntity;
import com.aimentor.domain.user.UserRole;

import java.time.LocalDateTime;

/**
 * 사용자 정보 응답 DTO
 * password 필드는 절대 포함하지 않음 (보안)
 */
public record UserResponseDto(
        Long id,
        String email,
        String name,
        String phone,
        String shippingPostalCode,
        String shippingAddress,
        String shippingDetailAddress,
        UserRole role,
        String provider,
        LocalDateTime createdAt
) {
    /** UserEntity 엔티티 → UserResponseDto 변환 */
    public static UserResponseDto from(UserEntity user) {
        return new UserResponseDto(
                user.getId(),
                user.getEmail(),
                user.getName(),
                user.getPhone(),
                user.getShippingPostalCode(),
                user.getShippingAddress(),
                user.getShippingDetailAddress(),
                user.getRole(),
                user.getProvider(),
                user.getCreatedAt()
        );
    }
}
