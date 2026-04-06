package com.aimentor.domain.profile.jobposting;

import com.aimentor.common.BaseTimeEntity;
import com.aimentor.domain.user.UserEntity;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;

/**
 * 채용공고 엔티티 (job_postings 테이블)
 * - 사용자가 스크랩/등록한 채용공고
 * - fileUrl   : 채용공고 PDF 등 첨부 파일 (선택)
 * - sourceUrl : URL 자동 등록 시 원본 공고 URL (선택)
 * - 면접 세션 생성 시 이 엔티티를 참조 가능
 */
@Entity
@Table(name = "job_postings")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class JobPostingEntity extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private UserEntity user;

    @Column(nullable = false, length = 100)
    private String company; // 회사명

    @Column(nullable = false, length = 200)
    private String position; // 포지션 (예: "백엔드 개발자", "Java 6년차")

    @Column(columnDefinition = "TEXT")
    private String description; // 채용공고 상세 내용

    /** 근무 지역 (예: 서울 강남구, 경기 성남시 판교 등) */
    @Column(length = 200)
    private String location;

    @Column(name = "file_url")
    private String fileUrl; // 공고 PDF 등 첨부 파일 URL

    @Column(name = "source_url", columnDefinition = "TEXT")
    private String sourceUrl; // URL 자동 등록 시 원본 공고 URL

    /** 지원 마감일 (D-Day 위젯에서 사용) */
    @Column(name = "due_date")
    private LocalDate dueDate;

    public void update(String company, String position, String description, String location) {
        this.company = company;
        this.position = position;
        this.description = description;
        this.location = location;
    }

    public void updateDueDate(LocalDate dueDate) {
        this.dueDate = dueDate;
    }

    public void updateFileUrl(String fileUrl) {
        this.fileUrl = fileUrl;
    }
}
