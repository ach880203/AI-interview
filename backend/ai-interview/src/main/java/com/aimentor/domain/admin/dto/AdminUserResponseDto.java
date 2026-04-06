package com.aimentor.domain.admin.dto;

import com.aimentor.domain.user.UserEntity;
import com.aimentor.domain.user.UserRole;

import java.time.LocalDateTime;

/**
 * 관리자 회원 목록 응답 DTO입니다.
 *
 * [역할]
 * 관리자 화면에서 회원 목록과 권한 상태를 보여 줄 때 사용합니다.
 */
public record AdminUserResponseDto(
        Long id,
        String email,
        String name,
        String phone,
        UserRole role,
        LocalDateTime createdAt
) {

    /**
     * 사용자 엔티티를 관리자 회원 응답 DTO로 변환합니다.
     *
     * @param user 사용자 엔티티
     * @return 관리자 회원 응답 DTO
     */
    public static AdminUserResponseDto from(UserEntity user) {
        return new AdminUserResponseDto(
                user.getId(),
                user.getEmail(),
                user.getName(),
                user.getPhone(),
                user.getRole(),
                user.getCreatedAt()
        );
    }
}
