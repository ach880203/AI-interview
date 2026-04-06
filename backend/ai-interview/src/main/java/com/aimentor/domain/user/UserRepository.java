package com.aimentor.domain.user;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

/**
 * 사용자 JPA 리포지토리
 * Spring Data JPA가 런타임에 구현체 자동 생성
 */
public interface UserRepository extends JpaRepository<UserEntity, Long> {

    /** 이메일로 사용자 조회 (로그인, 중복 검사) */
    Optional<UserEntity> findByEmail(String email);

    /** 이메일 중복 여부 확인 */
    boolean existsByEmail(String email);
}
