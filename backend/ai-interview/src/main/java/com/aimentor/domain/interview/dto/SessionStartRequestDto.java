package com.aimentor.domain.interview.dto;

/**
 * 면접 세션 시작 요청 DTO
 *
 * [역할]
 * POST /api/interviews/sessions 요청 본문을 담습니다.
 *
 * [필드 설명]
 * - resumeId      : 이력서 ID (선택) — 없으면 null
 * - coverLetterId : 자기소개서 ID (선택) — 없으면 null
 * - jobPostingId  : 채용공고 ID (선택) — 없으면 null
 * - questionType  : 질문 유형 ("GENERAL" / "TECHNICAL" / "BEHAVIORAL")
 *                   지정하지 않으면 AI가 GENERAL 유형으로 생성합니다.
 */
public record SessionStartRequestDto(
        Long resumeId,       // 이력서 ID (선택)
        Long coverLetterId,  // 자기소개서 ID (선택)
        Long jobPostingId,   // 채용공고 ID (선택)
        String questionType  // 질문 유형 (GENERAL / TECHNICAL / BEHAVIORAL)
) {}
