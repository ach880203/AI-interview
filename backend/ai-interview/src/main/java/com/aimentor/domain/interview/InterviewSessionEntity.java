package com.aimentor.domain.interview;

import com.aimentor.common.BaseTimeEntity;
import com.aimentor.domain.user.UserEntity;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * 면접 세션 엔티티 (interview_sessions 테이블)
 *
 * 관계:
 * - user: 면접 응시자 (N:1)
 * - resumeId / coverLetterId / jobPostingId: 참조 ID만 저장 (JOIN 없이 경량 설계)
 * - status: ONGOING(진행중) → COMPLETED(완료)
 * - startedAt: 세션 시작 시각 (생성 시 설정)
 * - endedAt: 면접 종료 시각 (endSession 호출 시 설정)
 */
@Entity
@Table(name = "interview_sessions")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class InterviewSessionEntity extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private UserEntity user;

    /** 이력서 ID (선택: 없으면 null) */
    @Column(name = "resume_id")
    private Long resumeId;

    /** 자기소개서 ID (선택: 없으면 null) */
    @Column(name = "cover_letter_id")
    private Long coverLetterId;

    /** 채용공고 ID (선택: 없으면 null) */
    @Column(name = "job_posting_id")
    private Long jobPostingId;

    /** 포지션 제목 (선택: 없으면 빈 문자열) */
    @Column(name = "position_title", nullable = false, length = 100)
    @Builder.Default
    private String positionTitle = "";

    /**
     * 레거시 DB 호환용 제목 컬럼입니다.
     *
     * 과거 스키마에는 title 컬럼이 있었고, 현재 코드는 position_title을 사용합니다.
     * 실제 DB에 title NOT NULL 제약이 남아 있는 환경이 있어서, 저장 직전에 두 컬럼을
     * 같은 값으로 맞춰 주지 않으면 면접 시작 insert가 500으로 실패합니다.
     *
     * 주의:
     * - 신규 코드에서는 positionTitle을 기준으로 사용합니다.
     * - 이 필드는 DB 호환을 위한 안전장치이며, 스키마 정리가 끝나면 제거 대상입니다.
     */
    @Column(name = "title", nullable = false, length = 100)
    @Builder.Default
    private String legacyTitle = "";

    /** 면접 유형 (선택: 기술/인성/압박/상황, null이면 AI가 자동 선택) */
    @Column(name = "question_type", length = 30)
    private String questionType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private SessionStatus status = SessionStatus.ONGOING;

    @Column(name = "started_at", nullable = false)
    private LocalDateTime startedAt;

    /**
     * 이 세션에서 원래 몇 개 질문을 진행할 계획이었는지 저장합니다.
     * 프런트 상태가 사라져도 전체 질문 수를 백엔드 기준으로 복원하기 위한 값입니다.
     */
    @Column(name = "planned_question_count", nullable = false)
    @Builder.Default
    private int plannedQuestionCount = 0;

    /**
     * 실제로 답변 저장이 끝난 질문 수입니다.
     * 중도 종료나 새로고침 이후에도 지금까지 답변한 범위를 정확히 보여주기 위해 사용합니다.
     */
    @Column(name = "answered_question_count", nullable = false)
    @Builder.Default
    private int answeredQuestionCount = 0;

    /**
     * 전체 질문을 모두 끝내지 않고 종료했는지 여부입니다.
     * 결과 화면에서 부분 완료 여부를 안정적으로 구분하기 위해 세션에 함께 저장합니다.
     */
    @Column(name = "is_partial_completed", nullable = false)
    @Builder.Default
    private boolean partialCompleted = false;

    /** 면접 종료 전: null */
    @Column(name = "ended_at")
    private LocalDateTime endedAt;

    /**
     * 저장 직전에 position_title / title 두 컬럼을 동기화합니다.
     *
     * 왜 필요한가:
     * - 운영/개발 DB마다 컬럼 상태가 달라질 수 있습니다.
     * - title 컬럼이 아직 남아 있고 NOT NULL이면 값이 없을 때 insert 자체가 실패합니다.
     *
     * 동작 원칙:
     * - 둘 다 비어 있으면 빈 문자열로 통일
     * - positionTitle이 있으면 legacyTitle도 같은 값으로 맞춤
     * - 반대로 legacyTitle만 남아 있으면 positionTitle을 복원
     */
    @PrePersist
    @PreUpdate
    private void syncLegacyTitleColumns() {
        String normalizedPositionTitle = positionTitle == null ? "" : positionTitle.trim();
        String normalizedLegacyTitle = legacyTitle == null ? "" : legacyTitle.trim();

        if (normalizedPositionTitle.isEmpty() && !normalizedLegacyTitle.isEmpty()) {
            normalizedPositionTitle = normalizedLegacyTitle;
        }

        if (normalizedLegacyTitle.isEmpty()) {
            normalizedLegacyTitle = normalizedPositionTitle;
        }

        this.positionTitle = normalizedPositionTitle;
        this.legacyTitle = normalizedLegacyTitle;
    }

    /**
     * 면접 종료 처리
     * status → COMPLETED, endedAt → 현재 시각
     */
    public void updateAnsweredQuestionCount(int answeredQuestionCount) {
        this.answeredQuestionCount = Math.max(answeredQuestionCount, 0);
    }

    /**
     * 면접 종료 처리입니다.
     * 전체 완료인지 부분 완료인지, 그리고 최종 답변 수를 함께 저장합니다.
     */
    public void complete(boolean partialCompleted, int answeredQuestionCount) {
        this.status = SessionStatus.COMPLETED;
        this.partialCompleted = partialCompleted;
        this.answeredQuestionCount = Math.max(answeredQuestionCount, 0);
        this.endedAt = LocalDateTime.now();
    }

    public enum SessionStatus {
        ONGOING,   // 면접 진행 중
        COMPLETED  // 면접 종료 (피드백 생성 완료)
    }
}
