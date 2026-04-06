package com.aimentor.domain.learning.dto;

import com.aimentor.domain.learning.LearningSubjectEntity;

/**
 * 학습 과목 응답 DTO
 *
 * [역할]
 * GET /api/learning/subjects 응답에 사용합니다.
 * 엔티티를 직접 노출하지 않고 DTO로 변환해 API 응답을 안정적으로 유지합니다.
 */
public record LearningSubjectResponseDto(

        /** 과목 ID */
        Long id,

        /** 과목명 (예: Java, Spring Boot, 운영체제) */
        String name,

        /** 과목 설명 */
        String description

) {
    /**
     * 엔티티 → DTO 변환 팩토리 메서드
     *
     * [왜 static factory를 사용하는가]
     * 변환 로직을 DTO 내부에 캡슐화하여 서비스 계층이 엔티티 구조를 몰라도 됩니다.
     *
     * @param entity 학습 과목 엔티티
     * @return 응답 DTO
     */
    public static LearningSubjectResponseDto from(LearningSubjectEntity entity) {
        return new LearningSubjectResponseDto(
                entity.getId(),
                entity.getName(),
                entity.getDescription()
        );
    }
}
