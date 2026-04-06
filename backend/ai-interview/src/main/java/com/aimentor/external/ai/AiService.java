package com.aimentor.external.ai;

import com.aimentor.external.ai.dto.DailyPracticeResultDto;
import com.aimentor.external.ai.dto.FeedbackDto;
import com.aimentor.external.ai.dto.GradeResultDto;
import com.aimentor.external.ai.dto.JobPostingScrapedDto;
import com.aimentor.external.ai.dto.ProblemDto;

import java.util.List;

/**
 * AI 서비스 추상화 인터페이스
 *
 * 구현체:
 * - MockAiService    : 하드코딩된 Mock 응답 (기본값, ai.service.mock=true)
 * - PythonAiService  : Python FastAPI 서버 실제 호출 (ai.service.mock=false)
 *
 * Python 서버 엔드포인트:
 * - POST /interview/question  → generateInterviewQuestion()
 * - POST /interview/feedback  → generateFeedback()
 * - POST /learning/generate   → generateLearningProblems()
 * - POST /learning/grade      → gradeLearningAnswer()
 *
 * 에러 처리:
 * - 서버 장애 시 AiServiceException 발생
 * - GlobalExceptionHandler → 503 Service Unavailable 응답
 */
public interface AiService {

    /**
     * 면접 질문 생성
     *
     * @param resumeContent      이력서 본문 (null이면 컨텍스트 없이 생성)
     * @param coverLetterContent 자기소개서 본문 (null이면 컨텍스트 없이 생성)
     * @param jobDescription     채용공고 내용 (null이면 컨텍스트 없이 생성)
     * @param history            이전 Q&A 이력 (후속 질문 생성 시 활용)
     * @param questionType       질문 유형 (INITIAL / FOLLOWUP)
     * @param sessionId          RAG 벡터 검색에 사용할 세션 ID (null이면 벡터 검색 생략)
     * @return AI가 생성한 면접 질문 문자열
     */
    String generateInterviewQuestion(String resumeContent,
                                     String coverLetterContent,
                                     String jobDescription,
                                     String history,
                                     String questionType,
                                     String sessionId);

    /**
     * 면접 전체 피드백 생성
     *
     * @param history         전체 Q&A 이력 (포맷: "Q1: ...\nA1: ...\n\nQ2: ...")
     * @param timingAnalysis  질문별 답변 시간 문자열 (예: "Q1: 45초, Q2: 120초") — null이면 시간 데이터 없음
     * @param jobDescription  채용공고 본문 — 키워드 분석에 사용. null이면 키워드 분석 건너뜀
     * @return 점수 + 약점 + 개선방향 + 모범답안 + 시간 분석 + 키워드 분석이 담긴 FeedbackDto
     */
    FeedbackDto generateFeedback(String history, String timingAnalysis, String jobDescription);

    /**
     * 학습 문제 생성
     *
     * [역할]
     * 프론트엔드에서 선택한 과목/난이도/문제 수/문제 유형을 바탕으로
     * AI 서버 또는 Mock 구현이 바로 사용할 수 있는 문제 목록을 생성합니다.
     *
     * [중요 포인트]
     * - type 값이 전달되지 않으면 객관식과 주관식의 형태가 뒤섞이거나
     *   프론트엔드가 기대한 입력 방식과 다른 응답이 내려올 수 있습니다.
     * - 그래서 문제 유형(MULTIPLE / SHORT / MIX)을 인터페이스 단계에서 함께 받습니다.
     *
     * @param subject    학습 과목명 (예: "Java", "Spring Boot", "운영체제")
     * @param difficulty 난이도 (EASY / MEDIUM / HARD)
     * @param count      생성할 문제 수
     * @param type       문제 유형 (MULTIPLE / SHORT / MIX)
     * @return 생성된 문제 목록
     */
    List<ProblemDto> generateLearningProblems(String subject, String difficulty, int count, String type, Integer userAccuracy);

    /**
     * 학습 답변 채점
     *
     * [역할]
     * 사용자의 답변을 문제, 정답, 해설과 함께 AI에 전달하여 채점합니다.
     * explanation을 함께 전달해야 AI가 더 정확한 피드백을 생성할 수 있습니다.
     *
     * @param question      문제 내용
     * @param correctAnswer 정답
     * @param userAnswer    사용자 답변
     * @param explanation   해설 (AI 피드백 품질 향상용, nullable)
     * @return 채점 결과 (정답여부, 점수, 피드백, 모범답안)
     */
    GradeResultDto gradeLearningAnswer(String question, String correctAnswer, String userAnswer, String explanation);

    /**
     * PDF 또는 이미지 파일에서 텍스트 추출
     *
     * [동작 방식]
     * PDF는 pypdf로 텍스트 레이어를 추출하고,
     * 이미지(JPG, PNG 등)는 GPT-4o Vision으로 OCR합니다.
     *
     * @param filename    원본 파일명 (확장자로 형식 판별)
     * @param fileBytes   파일 바이트 배열
     * @param contentType MIME 타입 (이미지 OCR 시 사용)
     * @return 추출된 텍스트
     */
    String extractDocumentText(String filename, byte[] fileBytes, String contentType);

    /**
     * 채용공고 URL 스크래핑 및 정보 추출
     *
     * [동작 방식]
     * Python AI 서버가 URL의 HTML을 가져온 뒤 GPT-4o로 핵심 정보를 파싱합니다.
     * 추출된 company/position/description을 그대로 JobPosting 엔티티에 저장합니다.
     *
     * [한계]
     * JavaScript로 동적 렌더링되는 SPA 페이지는 지원되지 않을 수 있습니다.
     *
     * @param url 채용공고 URL
     * @return GPT가 추출한 채용 정보 (company, position, description)
     */
    JobPostingScrapedDto scrapeJobPosting(String url);

    /**
     * 면접 세션 종료 후 ChromaDB 벡터 컬렉션 삭제
     *
     * [역할]
     * 면접이 끝난 세션의 임베딩 벡터를 ChromaDB에서 제거해 스토리지를 정리합니다.
     * DELETE /extract/vector/{sessionId} 를 호출합니다.
     *
     * [실패 처리]
     * 삭제 실패는 면접 결과에 영향을 주지 않으므로 예외를 전파하지 않습니다.
     * 구현체는 실패 시 log.warn만 남겨야 합니다.
     *
     * @param sessionId 종료된 면접 세션 ID (문자열)
     */
    void deleteVectorCollection(String sessionId);

    /**
     * 오늘의 연습질문 답변 평가
     *
     * @param question 면접 질문
     * @param answer   사용자 답변
     * @return 점수(0~100) + 간결한 피드백
     */
    DailyPracticeResultDto evaluateDailyPractice(String question, String answer);
}
