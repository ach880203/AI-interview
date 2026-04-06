package com.aimentor.domain.admin.dto;

import com.aimentor.domain.user.UserRole;
import jakarta.validation.constraints.NotNull;

/**
 * 관리자 사용자 권한 변경 요청 DTO
 *
 * [역할]
 * PUT /api/admin/users/{id}/role 요청 본문에 사용합니다.
 */
public record AdminUserRoleUpdateRequestDto(

        /** 변경할 사용자 권한 (USER / ADMIN) */
        @NotNull
        UserRole role

) {}
