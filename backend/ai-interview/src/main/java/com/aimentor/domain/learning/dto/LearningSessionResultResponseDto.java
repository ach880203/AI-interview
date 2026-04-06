package com.aimentor.domain.learning.dto;

import java.util.List;

/**
 * 학습 세션 결과 복원 응답 DTO입니다.
 *
 * [역할]
 * 프런트가 새로고침되더라도 부분 완료 결과나 전체 완료 결과를
 * 백엔드 저장값만으로 다시 그릴 수 있게 세션 단위 요약을 제공합니다.
 */
public record LearningSessionResultResponseDto(
        String sessionKey,
        Long subjectId,
        String subjectName,
        String difficulty,
        Integer totalProblemCount,
        Integer completedProblemCount,
        Integer correctCount,
        Integer accuracyRate,
        Boolean partialCompletion,
        List<LearningSessionResultItemDto> results
) {}
