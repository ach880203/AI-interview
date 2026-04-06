package com.aimentor.common;

import jakarta.persistence.Column;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.MappedSuperclass;
import lombok.Getter;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

/**
 * 모든 엔티티의 공통 시간 필드 기반 클래스
 * @MappedSuperclass: 이 클래스 자체는 테이블 생성 안 함, 상속받는 엔티티에 컬럼 추가
 * @EntityListeners: JPA Auditing으로 createdAt/updatedAt 자동 설정
 * 메인 클래스의 @EnableJpaAuditing과 함께 동작
 */
@Getter
@MappedSuperclass
@EntityListeners(AuditingEntityListener.class)
public abstract class BaseTimeEntity {

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
