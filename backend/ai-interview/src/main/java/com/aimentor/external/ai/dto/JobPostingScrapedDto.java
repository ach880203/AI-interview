package com.aimentor.external.ai.dto;

/**
 * 채용공고 스크래핑 결과 DTO
 *
 * [역할]
 * Python AI 서버(/scrape/job-posting)가 URL에서 추출한 채용공고 정보를
 * Spring Boot 내부에서 주고받을 때 사용하는 DTO입니다.
 *
 * [사용 흐름]
 * 사용자가 채용공고 URL을 붙여넣기 → JobPostingController
 *   → JobPostingService
 *     → PythonAiService.scrapeJobPosting(url)
 *       → JobPostingScrapedDto (이 클래스)
 *         → JobPostingEntity (DB 저장)
 *
 * [동작 방식]
 * 1. Python이 URL의 HTML을 가져옵니다.
 * 2. GPT-4o가 HTML에서 회사명, 직무, 채용 설명을 파싱합니다.
 * 3. 파싱된 세 가지 정보를 이 DTO로 반환합니다.
 *
 * [한계]
 * JavaScript로 동적 렌더링되는 SPA 페이지는 지원되지 않을 수 있습니다.
 */
public record JobPostingScrapedDto(

        /** 회사명: GPT가 추출한 채용 기업명 */
        String company,

        /** 직무명: GPT가 추출한 채용 포지션/직무 이름 */
        String position,

        /** 채용 설명: 업무 내용, 자격 요건, 우대 사항 등의 전체 채용 설명 */
        String description,

        /** 근무 지역: GPT가 추출한 근무지 (예: 서울 강남구, null 가능) */
        String location,

        /** 마감일: 스크래핑으로 추출한 지원 마감일 (yyyy-MM-dd, null 가능) */
        String due_date,

        /** 출처 URL: 원본 채용공고 URL */
        String source_url

) {}
