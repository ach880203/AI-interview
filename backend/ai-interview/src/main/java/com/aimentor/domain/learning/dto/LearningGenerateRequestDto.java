package com.aimentor.domain.learning.dto;

/**
 * 학습 문제 생성 요청 DTO
 *
 * [역할]
 * POST /api/learning/subjects/{id}/problems/generate 요청 본문을 담습니다.
 *
 * [필드 설명]
 * - difficulty  : 난이도 (EASY / MEDIUM / HARD)
 * - count       : 생성할 문제 수
 * - type        : 문제 유형 (MULTIPLE / SHORT / MIX)
 * - userAccuracy: 사용자의 현재 정답률 (AI가 난이도 조절에 활용, nullable)
 */
public record LearningGenerateRequestDto(
        String difficulty,
        Integer count,
        String type,
        Integer userAccuracy
) {}
