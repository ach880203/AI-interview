package com.aimentor.domain.user;

/**
 * 사용자 권한 열거형
 * USER: 일반 사용자 (면접 연습, 학습, 도서 구매)
 * ADMIN: 관리자 (도서 등록, 재고 관리, 사용자 권한 변경)
 */
public enum UserRole {
    USER,
    ADMIN
}
