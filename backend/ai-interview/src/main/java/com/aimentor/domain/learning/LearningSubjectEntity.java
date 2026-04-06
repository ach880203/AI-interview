package com.aimentor.domain.learning;

import com.aimentor.common.BaseTimeEntity;
import jakarta.persistence.*;
import lombok.*;

/**
 * 학습 과목 정보를 저장하는 엔티티입니다.
 *
 * [역할]
 * 자바, 운영체제, 데이터베이스 같은 학습 분류를 저장하고
 * 문제 생성과 학습 통계 집계 시 기준 과목으로 사용됩니다.
 */
@Entity
@Table(name = "learning_subjects")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class LearningSubjectEntity extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * 화면과 문제 생성 프롬프트에 사용하는 과목 이름입니다.
     *
     * [unique = true 이유]
     * data.sql의 INSERT IGNORE는 UNIQUE 제약 조건 위반이 발생할 때만 중복을 건너뜁니다.
     * unique 없이 INSERT IGNORE를 사용하면 제약 조건이 없으므로
     * 매 애플리케이션 시작마다 9개 과목이 그대로 삽입되어 무한 중복이 발생합니다.
     */
    @Column(nullable = false, unique = true)
    private String name;

    /**
     * 과목에 대한 간단한 설명입니다.
     */
    @Column(columnDefinition = "TEXT")
    private String description;
}
