package com.aimentor.domain.profile.coverletter;

import com.aimentor.common.BaseTimeEntity;
import com.aimentor.domain.user.UserEntity;
import jakarta.persistence.*;
import lombok.*;

/**
 * 자기소개서 엔티티 (cover_letters 테이블)
 * - 파일 첨부 없음 (텍스트 기반)
 * - 로그인한 사용자만 자신의 자소서 CRUD 가능
 */
@Entity
@Table(name = "cover_letters")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class CoverLetterEntity extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private UserEntity user;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String content;

    @Column(name = "file_url")
    private String fileUrl;

    public void update(String title, String content) {
        this.title = title;
        this.content = content;
    }

    public void updateFileUrl(String fileUrl) {
        this.fileUrl = fileUrl;
    }
}
