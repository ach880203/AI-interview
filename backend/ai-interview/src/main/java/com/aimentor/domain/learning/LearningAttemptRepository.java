package com.aimentor.domain.learning;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

/**
 * 학습 시도 엔티티 전용 JPA 레포지토리입니다.
 *
 * [역할]
 * 사용자별 학습 시도 목록을 조회해서 학습 통계를 계산할 때 사용합니다.
 */
public interface LearningAttemptRepository extends JpaRepository<LearningAttemptEntity, Long> {

    /**
     * 특정 사용자의 학습 시도 목록을 최신순으로 조회합니다.
     *
     * @param userId 사용자 ID
     * @return 최신순 학습 시도 목록
     */
    List<LearningAttemptEntity> findByUserIdOrderByCreatedAtDesc(Long userId);

    /**
     * 특정 사용자의 오답(isCorrect=false) 목록을 최신순으로 조회합니다.
     *
     * @param userId 사용자 ID
     * @return 최신순 오답 목록
     */
    List<LearningAttemptEntity> findByUserIdAndIsCorrectFalseOrderByCreatedAtDesc(Long userId);

    /**
     * N+1 방지: subject를 JOIN FETCH하여 한 번의 쿼리로 시도 목록과 과목 정보를 함께 조회합니다.
     *
     * [왜 별도 JPQL 쿼리가 필요한가]
     * findByUserId...는 LearningAttemptEntity만 조회하므로,
     * attempt.getSubject().getName() 호출 시 과목마다 SELECT 쿼리가 추가 발생합니다. (N+1)
     * LEFT JOIN FETCH로 과목 정보를 한 번에 가져오면 쿼리 1회로 처리됩니다.
     *
     * @param userId 사용자 ID
     * @return subject가 함께 로드된 최신순 학습 시도 목록
     */
    @Query("SELECT a FROM LearningAttemptEntity a LEFT JOIN FETCH a.subject WHERE a.user.id = :userId ORDER BY a.createdAt DESC")
    List<LearningAttemptEntity> findByUserIdWithSubjectOrderByCreatedAtDesc(@Param("userId") Long userId);

    /**
     * N+1 방지: subject를 JOIN FETCH하여 오답 목록을 조회합니다.
     *
     * @param userId 사용자 ID
     * @return subject가 함께 로드된 최신순 오답 목록
     */
    @Query("SELECT a FROM LearningAttemptEntity a LEFT JOIN FETCH a.subject WHERE a.user.id = :userId AND a.isCorrect = false ORDER BY a.createdAt DESC")
    List<LearningAttemptEntity> findWrongAnswersByUserIdWithSubject(@Param("userId") Long userId);

    /**
     * 같은 세션 키로 저장된 학습 결과를 문제 순서대로 다시 읽어옵니다.
     * 새로고침 뒤 결과 복원은 이 조회를 기준으로 동작합니다.
     */
    @Query("""
            SELECT a
            FROM LearningAttemptEntity a
            LEFT JOIN FETCH a.subject
            WHERE a.user.id = :userId
              AND a.sessionKey = :sessionKey
            ORDER BY a.sessionProblemOrder ASC, a.createdAt ASC
            """)
    List<LearningAttemptEntity> findByUserIdAndSessionKeyWithSubjectOrderBySessionProblemOrder(
            @Param("userId") Long userId,
            @Param("sessionKey") String sessionKey
    );
}
