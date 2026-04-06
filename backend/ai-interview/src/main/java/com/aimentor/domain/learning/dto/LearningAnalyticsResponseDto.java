package com.aimentor.domain.learning.dto;

import java.util.List;

/** 학습 분석 응답 DTO — GET /api/learning/analytics 응답에 사용합니다. */
public record LearningAnalyticsResponseDto(List<CategoryAnalyticsDto> categories) {}
