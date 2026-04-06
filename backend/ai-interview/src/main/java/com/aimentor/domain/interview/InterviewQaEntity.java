package com.aimentor.domain.interview;

import com.aimentor.common.BaseTimeEntity;
import jakarta.persistence.*;
import lombok.*;

/**
 * 면접 Q&A 엔티티 (interview_qas 테이블)
 *
 * 관계: InterviewSessionEntity (N:1)
 *
 * 흐름:
 * 1. 세션 시작 시 첫 번째 질문 생성 (answerText = null, audioUrl = null)
 * 2. 사용자가 답변 제출 → answerText, audioUrl 저장
 * 3. 다음 질문 생성 → 새 InterviewQaEntity 저장
 */
@Entity
@Table(
        name = "interview_qas",
        indexes = {
                // 세션 내 질문 순서 조회에 사용 (submitAnswer, getSessionDetail, buildHistory)
                @Index(name = "idx_interview_qas_session_order", columnList = "session_id, order_num")
        }
)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class InterviewQaEntity extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "session_id", nullable = false)
    private InterviewSessionEntity session;

    /** 질문 순서 (1부터 시작, 최대 5) */
    @Column(name = "order_num", nullable = false)
    private int orderNum;

    /** AI가 생성한 면접 질문 */
    @Column(nullable = false, columnDefinition = "TEXT")
    private String question;

    /** STT 변환된 사용자 답변 (답변 전: null) */
    @Column(name = "answer_text", columnDefinition = "TEXT")
    private String answerText;

    /** S3에 저장된 음성 파일 URL (답변 전: null, TODO: 실제 STT 연동) */
    @Column(name = "audio_url")
    private String audioUrl;

    /** 답변 녹음 시간 (초 단위, 직접 입력 시 null) */
    @Column(name = "answer_duration")
    private Integer answerDuration;

    /** 사용자 답변 저장 (STT 결과 + S3 URL + 녹음 시간) */
    public void saveAnswer(String answerText, String audioUrl, Integer answerDuration) {
        this.answerText = answerText;
        this.audioUrl = audioUrl;
        this.answerDuration = answerDuration;
    }
}
