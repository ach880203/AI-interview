package com.aimentor.domain.user.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * 회원가입 요청 DTO
 * @Valid 적용 시 Controller에서 자동 검증
 * 검증 실패 시 GlobalExceptionHandler → 400 Bad Request 반환
 */
public record RegisterRequestDto(

        @NotBlank(message = "이메일은 필수입니다.")
        @Email(message = "올바른 이메일 형식이 아닙니다.")
        String email,

        @NotBlank(message = "비밀번호는 필수입니다.")
        @Size(min = 8, message = "비밀번호는 8자 이상이어야 합니다.")
        String password,

        @NotBlank(message = "이름은 필수입니다.")
        @Size(min = 2, max = 50, message = "이름은 2~50자 사이여야 합니다.")
        String name,

        @Pattern(regexp = "^01[0-9]-?\\d{3,4}-?\\d{4}$", message = "올바른 전화번호 형식이 아닙니다.")
        String phone // 선택 입력
) {}
