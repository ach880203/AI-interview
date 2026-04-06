package com.aimentor.domain.learning.dto;

import java.util.List;

/**
 * 학습 문제 응답 DTO
 *
 * [역할]
 * AI가 생성한 학습 문제 하나를 프론트엔드로 전달할 때 사용합니다.
 * 객관식(MULTIPLE)과 주관식(SHORT) 모두 이 DTO로 처리합니다.
 */
public record LearningProblemDto(
        /** 문제 유형 (MULTIPLE / SHORT) */
        String type,
        /** 문제 본문 */
        String question,
        /** 객관식 선택지 (주관식이면 null) */
        List<String> choices,
        /** 정답 */
        String correctAnswer,
        /** 해설 */
        String explanation
) {}
