package com.aimentor.domain.support;

import com.aimentor.common.BaseTimeEntity;
import jakarta.persistence.*;
import lombok.*;

/**
 * 고객센터 FAQ 엔티티입니다.
 *
 * [역할]
 * 고객센터 화면에 노출되는 자주 묻는 질문을 운영 데이터로 관리합니다.
 *
 * [이유]
 * FAQ를 코드 상수로만 두면 관리자 화면에서 수정할 수 없고,
 * 운영 중 문구를 바꾸려 해도 배포가 다시 필요해집니다.
 */
@Entity
@Table(name = "customer_center_faqs")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class CustomerCenterFaqEntity extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 60)
    private String category;

    @Column(nullable = false, length = 255)
    private String question;

    @Lob
    @Column(nullable = false)
    private String answer;

    /**
     * FAQ 문구를 수정합니다.
     * 관리 화면에서 한 번에 세 필드를 같이 저장하므로 메서드도 한 번에 갱신하도록 묶었습니다.
     */
    public void update(String category, String question, String answer) {
        this.category = category;
        this.question = question;
        this.answer = answer;
    }
}
