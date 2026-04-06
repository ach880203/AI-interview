package com.aimentor.domain.user;

import com.aimentor.common.BaseTimeEntity;
import jakarta.persistence.*;
import lombok.*;

/**
 * 사용자 엔티티 (users 테이블)
 * - email: 로그인 ID (unique)
 * - password: BCrypt 암호화 저장
 * - role: USER(일반) / ADMIN(관리자)
 * - phone: 선택적 연락처
 */
@Entity
@Table(name = "users")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class UserEntity extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 100)
    private String email;

    @Column(nullable = false)
    private String password; // BCrypt 암호화 저장 (원문 저장 금지)

    @Column(nullable = false, length = 50)
    private String name;

    @Column(length = 20)
    private String phone; // 선택 입력 (nullable)

    /**
     * 기본 배송지의 우편번호입니다.
     * 주소 검색 공급자를 붙였을 때 도로명 주소와 함께 저장해 주문서 자동 입력 정확도를 높입니다.
     */
    @Column(name = "shipping_postal_code", length = 10)
    private String shippingPostalCode;

    /**
     * 주문서 자동 입력에 사용하는 기본 배송지입니다.
     * 주소 검색 API를 붙이기 전까지는 사용자가 직접 저장한 값을 그대로 재사용합니다.
     */
    @Column(name = "shipping_address", length = 255)
    private String shippingAddress;

    /**
     * 기본 배송지의 상세 주소입니다.
     * 기본 주소와 분리해 두면 주문서에서 수정 지점을 더 쉽게 설명할 수 있습니다.
     */
    @Column(name = "shipping_detail_address", length = 255)
    private String shippingDetailAddress;

    /**
     * 인증 제공자 (LOCAL: 이메일 가입, KAKAO: 카카오 OAuth)
     * OAuth 사용자는 password가 랜덤 UUID로 채워지며, 비밀번호 로그인이 불가합니다.
     */
    @Column(nullable = false, length = 20)
    @Builder.Default
    private String provider = "LOCAL";

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    @Builder.Default
    private UserRole role = UserRole.USER;

    /** 관리자 권한 변경 (ADMIN API 전용) */
    public void updateRole(UserRole role) {
        this.role = role;
    }

    /**
     * 마이페이지에서 수정한 기본 프로필과 배송 정보를 한 번에 반영합니다.
     *
     * [주의]
     * 주문서 자동 입력이 이 값을 그대로 재사용하므로,
     * 여기서 빈 문자열을 null로 정리해 두면 프런트에서 "저장된 값이 있는지"를 단순하게 판단할 수 있습니다.
     */
    public void updateProfile(
            String name,
            String phone,
            String shippingPostalCode,
            String shippingAddress,
            String shippingDetailAddress
    ) {
        this.name = name;
        this.phone = phone;
        this.shippingPostalCode = shippingPostalCode;
        this.shippingAddress = shippingAddress;
        this.shippingDetailAddress = shippingDetailAddress;
    }

    /**
     * 주문서에서 사용한 배송지를 기본 배송지로 저장합니다.
     *
     * [의도]
     * 주문자는 가족이나 지인의 이름으로 주문할 수도 있어서
     * 주문자 이름/연락처와 기본 프로필은 건드리지 않고 배송지 정보만 따로 갱신합니다.
     */
    public void updateDefaultShippingInfo(
            String shippingPostalCode,
            String shippingAddress,
            String shippingDetailAddress
    ) {
        this.shippingPostalCode = shippingPostalCode;
        this.shippingAddress = shippingAddress;
        this.shippingDetailAddress = shippingDetailAddress;
    }
}
