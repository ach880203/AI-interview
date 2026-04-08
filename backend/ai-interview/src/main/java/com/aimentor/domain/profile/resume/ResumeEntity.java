package com.aimentor.domain.profile.resume;

import com.aimentor.common.BaseTimeEntity;
import com.aimentor.domain.user.UserEntity;
import jakarta.persistence.*;
import lombok.*;

/**
 * 이력서 엔티티 (resumes 테이블)
 * - 로그인한 사용자만 자신의 이력서 CRUD 가능
 * - fileUrl: S3에 업로드된 이력서 파일 URL (선택)
 */
@Entity
@Table(name = "resumes")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class ResumeEntity extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 이력서 소유자 (지연 로딩: 조회 시 불필요한 UserEntity 쿼리 방지) */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private UserEntity user;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String content;

    /** S3 업로드 파일 URL (nullable: 파일 없이 텍스트만 입력 가능) */
    @Column(name = "file_url")
    private String fileUrl;

    /** 사용자가 업로드한 원본 파일명 (nullable) */
    @Column(name = "original_file_name", length = 500)
    private String originalFileName;

    /** 제목/내용 수정 */
    public void update(String title, String content) {
        this.title = title;
        this.content = content;
    }

    /** 파일 URL 및 원본 파일명 업데이트 (파일 업로드/재업로드 시) */
    public void updateFileUrl(String fileUrl, String originalFileName) {
        this.fileUrl = fileUrl;
        this.originalFileName = originalFileName;
    }
}
