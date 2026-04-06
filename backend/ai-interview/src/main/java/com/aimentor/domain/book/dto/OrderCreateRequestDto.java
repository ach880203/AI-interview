package com.aimentor.domain.book.dto;

import com.aimentor.domain.book.OrderPaymentMethod;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * 주문 생성 요청 DTO
 * POST /api/orders
 *
 * 요청 예시:
 * {
 *   "ordererName": "홍길동",
 *   "ordererPhone": "010-1234-5678",
 *   "postalCode": "06236",
 *   "address": "서울시 강남구 테헤란로 123",
 *   "paymentMethod": "KAKAOPAY",
 *   "items": [
 *     { "bookId": 1, "quantity": 2 },
 *     { "bookId": 3, "quantity": 1 }
 *   ]
 * }
 */
public record OrderCreateRequestDto(

        @NotBlank(message = "주문자 이름은 필수입니다.")
        String ordererName,

        @NotBlank(message = "주문자 연락처는 필수입니다.")
        @Pattern(regexp = "^[0-9-]+$", message = "주문자 연락처는 숫자와 하이픈만 입력할 수 있습니다.")
        String ordererPhone,

        @NotBlank(message = "우편번호는 필수입니다.")
        @Pattern(regexp = "^[0-9]{5}$", message = "우편번호는 5자리 숫자로 입력해주세요.")
        String postalCode,

        @NotBlank(message = "배송지 주소는 필수입니다.")
        String address,

        @Size(max = 255, message = "상세 주소는 255자 이하로 입력해주세요.")
        String detailAddress,

        @NotNull(message = "결제 수단은 필수입니다.")
        OrderPaymentMethod paymentMethod,

        Boolean saveShippingInfo,

        @NotEmpty(message = "주문 항목은 1개 이상이어야 합니다.")
        @Valid
        List<OrderItemRequestDto> items
) {
    /**
     * 주문 항목 요청 DTO (중첩 record)
     */
    public record OrderItemRequestDto(

            @NotNull(message = "도서 ID는 필수입니다.")
            Long bookId,

            @NotNull(message = "수량은 필수입니다.")
            @Min(value = 1, message = "수량은 1 이상이어야 합니다.")
            Integer quantity
    ) {}
}
