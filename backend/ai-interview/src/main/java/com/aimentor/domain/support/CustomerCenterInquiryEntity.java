package com.aimentor.domain.support;

import com.aimentor.common.BaseTimeEntity;
import com.aimentor.domain.user.UserEntity;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * 고객센터 문의 엔티티입니다.
 *
 * [역할]
 * 사용자가 남긴 문의 제목, 내용, 관리자 답변, 답변 상태를 한 테이블에 저장합니다.
 *
 * [설계 이유]
 * FAQ는 지금 단계에서 정적 안내 성격이 강하므로 프런트 상수로 두고,
 * 실제로 누적되어야 하는 문의 이력만 먼저 백엔드 도메인으로 분리합니다.
 */
@Entity
@Table(name = "customer_center_inquiries")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class CustomerCenterInquiryEntity extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private UserEntity user;

    @Column(nullable = false, length = 120)
    private String title;

    @Lob
    @Column(nullable = false)
    private String content;

    @Lob
    private String reply;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private InquiryStatus status = InquiryStatus.WAITING;

    private LocalDateTime answeredAt;

    /** 공개/비밀글 여부 (true = 공개, false = 비밀) */
    @Column(nullable = false)
    @Builder.Default
    private boolean isPublic = false;

    /** 도움됨 카운트 — 20 이상이면 FAQ 자동 승격 대상 */
    @Column(nullable = false)
    @Builder.Default
    private int helpfulCount = 0;

    /**
     * 관리자 답변을 저장합니다.
     *
     * [주의]
     * 답변이 한 번 저장되면 상태를 답변 완료로 바꾸고, 답변 시각도 함께 남깁니다.
     * 이후 같은 문의를 다시 수정해도 "답변 완료" 상태는 유지됩니다.
     */
    public void saveReply(String reply) {
        this.reply = reply;
        this.status = InquiryStatus.ANSWERED;
        this.answeredAt = LocalDateTime.now();
    }

    /** 도움됨 카운트를 1 증가시킵니다. */
    public void incrementHelpful() {
        this.helpfulCount++;
    }

    /**
     * 관리자가 공개 문의를 비밀글로 전환합니다.
     *
     * [의도]
     * 공개로 올라간 문의가 운영 정책상 더 이상 노출되면 안 되는 경우가 있어
     * 관리자만 "공개 → 비밀" 방향으로 한 번 더 잠글 수 있게 합니다.
     *
     * [주의]
     * 일반 사용자가 다시 공개글로 되돌리는 흐름은 허용하지 않습니다.
     */
    public void makePrivate() {
        this.isPublic = false;
    }

    /**
     * 문의 처리 상태입니다.
     * 화면에는 label 값을 그대로 보여주면 되도록 한글 라벨을 함께 관리합니다.
     */
    @Getter
    @RequiredArgsConstructor
    public enum InquiryStatus {
        WAITING("답변 대기"),
        ANSWERED("답변 완료");

        private final String label;
    }
}
