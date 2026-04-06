package com.aimentor.domain.user.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * 로그인 사용자가 마이페이지에서 수정하는 기본 프로필/배송 정보 요청 DTO입니다.
 *
 * [의도]
 * 주문서 자동 입력에 필요한 값만 먼저 분리해서 저장하면
 * 이후 주소 검색 API나 기본 배송지 다중 관리 기능을 붙이기 쉬워집니다.
 */
public record UserProfileUpdateRequestDto(
        @NotBlank(message = "이름은 필수입니다.")
        @Size(max = 50, message = "이름은 50자 이하로 입력해주세요.")
        String name,

        @Size(max = 20, message = "연락처는 20자 이하로 입력해주세요.")
        String phone,

        @Size(max = 10, message = "우편번호는 10자 이하로 입력해주세요.")
        @Pattern(regexp = "^[0-9-]*$", message = "우편번호는 숫자와 하이픈만 입력할 수 있습니다.")
        String shippingPostalCode,

        @Size(max = 255, message = "기본 배송지는 255자 이하로 입력해주세요.")
        String shippingAddress,

        @Size(max = 255, message = "상세 배송지는 255자 이하로 입력해주세요.")
        String shippingDetailAddress
) {
}
