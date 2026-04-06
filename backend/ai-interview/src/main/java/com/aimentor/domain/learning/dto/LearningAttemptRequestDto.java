package com.aimentor.domain.learning.dto;

/**
 * 학습 문제 채점 요청 DTO입니다.
 *
 * [역할]
 * POST /api/learning/attempts 요청 본문을 담습니다.
 * 사용자가 제출한 답안과 세션 복구에 필요한 최소 메타데이터를 함께 받습니다.
 */
public record LearningAttemptRequestDto(
        /** 과목 ID (nullable, 과목 없이 시도하는 경우 허용) */
        Long subjectId,
        /** 난이도 (EASY / MEDIUM / HARD) */
        String difficulty,
        /** 문제 유형 (MULTIPLE / SHORT) */
        String problemType,
        /** 문제 본문 */
        String question,
        /** 정답 */
        String correctAnswer,
        /** 사용자가 제출한 답안 */
        String userAnswer,
        /** 같은 학습 흐름을 구분하는 세션 키 */
        String sessionKey,
        /** 원래 풀 예정이었던 전체 문제 수 */
        Integer sessionProblemCount,
        /** 현재 제출한 문제가 세션 내 몇 번째 문제인지 */
        Integer sessionProblemOrder,
        /** 해설 */
        String explanation
) {}
