package com.aimentor.external.ai;

import com.aimentor.external.ai.dto.DailyPracticeResultDto;
import com.aimentor.external.ai.dto.FeedbackDto;
import com.aimentor.external.ai.dto.GradeResultDto;
import com.aimentor.external.ai.dto.JobPostingScrapedDto;
import com.aimentor.external.ai.dto.ProblemDto;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

/**
 * AI 서비스 Mock 구현체
 *
 * [역할]
 * 실제 Python AI 서버 없이도 프론트엔드와 백엔드 흐름을 검증할 수 있도록
 * 고정된 질문, 피드백, 학습 문제를 반환합니다.
 *
 * [언제 사용되는가]
 * application 설정에서 `ai.service.mock=true`일 때 활성화됩니다.
 * 로컬 개발이나 기본 화면 검증 단계에서 빠르게 동작을 확인할 때 유용합니다.
 */
@Slf4j
@Service
@ConditionalOnProperty(name = "ai.service.mock", havingValue = "true", matchIfMissing = true)
public class MockAiService implements AiService {

    /** 면접 질문 풀입니다. 질문 순서는 이전 Q 개수에 따라 결정됩니다. */
    private static final List<String> MOCK_QUESTIONS = List.of(
            "간단하게 자기소개를 해주세요.",
            "지원하신 직무와 잘 맞는다고 생각하는 본인의 강점은 무엇인가요?",
            "가장 어려웠던 기술 문제를 해결한 과정을 구체적으로 설명해주세요.",
            "팀 프로젝트에서 갈등이 발생했을 때 어떻게 해결하셨나요?",
            "5년 뒤 커리어 목표는 무엇이고, 이를 위해 어떤 준비를 하고 있나요?"
    );

    /**
     * 주관식 문제 원본 데이터입니다.
     * 각 항목은 문제, 정답, 해설 순서로 구성됩니다.
     */
    private static final List<String[]> MOCK_SHORT_POOL = List.of(
            new String[]{
                    "JVM의 Garbage Collection 동작 원리를 설명하세요.",
                    "GC는 메모리에서 더 이상 참조되지 않는 객체를 탐지하고 회수하는 과정입니다.",
                    "Young/Old 영역, Minor GC와 Major GC의 차이를 함께 설명하면 좋습니다."
            },
            new String[]{
                    "동시성 문제를 해결하는 대표적인 방법을 설명하세요.",
                    "synchronized, volatile, Atomic 클래스, Lock 계열을 사용해 해결할 수 있습니다.",
                    "각 방법의 차이와 언제 어떤 방법을 선택하는지가 핵심입니다."
            },
            new String[]{
                    "RESTful API 설계 원칙을 설명하세요.",
                    "자원 중심 URL, HTTP 메서드 분리, 무상태성 원칙이 핵심입니다.",
                    "URI는 명사 중심으로 설계하고 행위는 HTTP 메서드로 표현합니다."
            },
            new String[]{
                    "인덱스는 무엇이며 언제 사용하는 것이 좋은지 설명하세요.",
                    "인덱스는 검색 성능을 높이는 자료구조로 조회가 많은 컬럼에 적합합니다.",
                    "읽기 성능은 좋아지지만 쓰기 성능과 저장 공간은 비용이 늘 수 있습니다."
            },
            new String[]{
                    "TCP와 UDP의 차이를 설명하세요.",
                    "TCP는 연결 지향이며 신뢰성을 보장하고, UDP는 비연결 기반으로 빠른 전송에 유리합니다.",
                    "3-way handshake, 흐름 제어, 재전송 여부를 함께 설명하면 이해가 쉽습니다."
            }
    );

    /**
     * 객관식 문제 원본 데이터입니다.
     * 각 항목은 문제, 정답, 해설, 선택지 4개 순서로 구성됩니다.
     */
    private static final List<String[]> MOCK_MULTIPLE_POOL = List.of(
            new String[]{
                    "Java에서 == 와 equals()의 차이는 무엇인가요?",
                    "equals()는 객체의 내용 비교에 사용됩니다.",
                    "== 는 참조 비교, equals()는 내용 비교라는 점이 핵심입니다.",
                    "== 는 항상 true를 반환한다.",
                    "equals()는 주소값을 비교한다.",
                    "== 와 equals()는 완전히 같다.",
                    "equals()는 객체의 내용 비교에 사용됩니다."
            },
            new String[]{
                    "Spring의 @Transactional 기본 격리 수준은 무엇인가요?",
                    "DEFAULT",
                    "Spring은 별도 지정이 없으면 데이터베이스 기본 격리 수준을 따릅니다.",
                    "READ_UNCOMMITTED",
                    "READ_COMMITTED",
                    "REPEATABLE_READ",
                    "DEFAULT"
            },
            new String[]{
                    "인증 실패에 해당하는 대표 HTTP 상태 코드는 무엇인가요?",
                    "401 Unauthorized",
                    "401은 인증 실패, 403은 인증은 되었지만 권한이 없을 때 사용합니다.",
                    "200 OK",
                    "403 Forbidden",
                    "404 Not Found",
                    "401 Unauthorized"
            },
            new String[]{
                    "ArrayList가 LinkedList보다 유리한 경우는 무엇인가요?",
                    "인덱스 기반 임의 접근이 많을 때입니다.",
                    "ArrayList는 내부적으로 배열을 사용해 인덱스 접근이 빠릅니다.",
                    "중간 삽입이 많을 때입니다.",
                    "양방향 순회만 있을 때입니다.",
                    "인덱스 기반 임의 접근이 많을 때입니다.",
                    "노드 삭제가 많을 때입니다."
            },
            new String[]{
                    "JWT의 구성 요소 3가지는 무엇인가요?",
                    "Header, Payload, Signature",
                    "JWT는 헤더, 페이로드, 서명 세 부분을 점(.)으로 연결한 구조입니다.",
                    "Header, Body, Footer",
                    "Token, Claim, Secret",
                    "Header, Payload, Signature",
                    "Access, Refresh, Session"
            }
    );

    /**
     * 면접 질문 생성
     *
     * [동작 방식]
     * 이전 Q 개수를 세어 다음 질문 순서를 결정합니다.
     * 면접이 길어져도 마지막 질문을 반복해 반환하도록 안전 장치를 둡니다.
     */
    @Override
    public String generateInterviewQuestion(String resumeContent, String coverLetterContent,
                                            String jobDescription, String history, String questionType,
                                            String sessionId) {
        // Mock 구현에서는 sessionId(RAG 컨텍스트)를 사용하지 않습니다.
        int questionCount = (int) history.lines()
                .filter(line -> line.matches("^Q\\d+:.*"))
                .count();

        int index = Math.min(questionCount, MOCK_QUESTIONS.size() - 1);
        String question = MOCK_QUESTIONS.get(index);

        log.debug("[MockAI] 면접 질문 생성: index={}, question={}", index, question);
        return question;
    }

    /**
     * 면접 피드백 생성
     *
     * [동작 방식]
     * 실제 분석 대신 고정된 점수와 예시 피드백을 반환합니다.
     * 프론트엔드 결과 화면과 백엔드 저장 흐름 검증이 목적입니다.
     */
    @Override
    public FeedbackDto generateFeedback(String history, String timingAnalysis, String jobDescription) {
        log.debug("[MockAI] 면접 피드백 생성 요청: historyLength={}", history.length());

        return new FeedbackDto(
                72,  // logicScore
                78,  // relevanceScore
                55,  // specificityScore
                65,  // communicationScore
                70,  // professionalismScore
                68,  // overallScore
                "질문의 핵심을 정확히 파악하고 답변한 점이 좋았습니다. 특히 프로젝트 경험을 언급할 때 팀 내 역할을 명확히 설명한 부분이 인상적입니다.",
                "답변에 구체적인 수치와 실제 경험이 더 들어가면 좋습니다. STAR 구조로 정리하면 전달력이 좋아집니다.",
                "프로젝트 이름, 맡은 역할, 개선 수치처럼 검증 가능한 근거를 더 자주 포함해 보세요.",
                "Q1. 자기소개\n→ 답변 평가: 경력 요약은 잘 했으나 지원 동기 연결이 부족합니다.\n→ STAR 적용 여부: ✗ (Action·Result 누락)\n→ 모범 답변 예시: 경력 요약 후 '이 경험을 바탕으로 귀사의 OO 프로젝트에 기여하고 싶습니다'로 연결하세요.",
                62,  // attitudeScore
                "답변 중 '것 같아요', '아마도' 등 헤징 표현이 자주 보입니다. 자신감 있는 단정적 표현을 연습하세요.",
                58,  // starScore
                85,  // consistencyScore
                "전체 답변에서 경력 기간·프로젝트 규모 등 사실 정보가 일관되게 유지되었습니다.",
                "프로젝트에서 맡은 역할과 개선 결과를 수치 중심으로 설명하면 강점이 더 분명하게 전달됩니다.",
                "Q1: 45초 (짧음 — 좀 더 구체적으로 설명하면 좋겠습니다)\nQ2: 92초 (적당)\nQ3: 67초 (적당)\nQ4: 185초 (김 — 핵심을 먼저 말하고 보완 설명을 이어가는 방식으로 개선해보세요)\nQ5: 78초 (적당)\n\n[종합] 답변 길이가 적정 범위(60~120초)를 벗어나는 경우가 있습니다. Q1은 내용을 더 보충하고, Q4는 핵심 전달력을 높이는 연습을 권장합니다.",
                "[채용공고 키워드 커버리지 — Mock 데이터]\n✅ 언급된 키워드: Spring Boot, REST API, JPA, MySQL\n❌ 미언급 키워드: AWS, MSA, 코드 리뷰, 대용량 데이터 처리\n\n[분석] 핵심 기술 스택(Spring Boot·JPA)은 잘 언급했으나, 채용공고에서 우대하는 AWS 운영 경험과 MSA 설계 역량에 대한 언급이 없어 해당 질문에서 차별화 포인트를 놓쳤습니다. 다음 면접에서는 관련 경험을 구체적으로 준비해두세요."
        );
    }

    /**
     * 학습 문제 생성
     *
     * [역할]
     * 요청 타입에 맞는 주관식/객관식 문제를 count 수만큼 생성합니다.
     *
     * [동작 방식]
     * - SHORT: 모두 주관식 문제로 생성
     * - MULTIPLE: 모두 객관식 문제로 생성
     * - MIX: 문제마다 객관식과 주관식을 번갈아 생성
     */
    @Override
    public List<ProblemDto> generateLearningProblems(String subject, String difficulty, int count, String type, Integer userAccuracy) {
        log.debug("[MockAI] 학습 문제 생성: subject={}, difficulty={}, count={}, type={}, userAccuracy={}",
                subject, difficulty, count, type, userAccuracy);

        List<ProblemDto> result = new ArrayList<>();

        for (int index = 0; index < count; index++) {
            String resolvedType = resolveProblemType(type, index);
            if ("MULTIPLE".equals(resolvedType)) {
                result.add(createMultipleProblem(subject, difficulty, index));
                continue;
            }
            result.add(createShortProblem(subject, difficulty, index));
        }

        return result;
    }

    /**
     * 답안 채점
     *
     * [동작 방식]
     * Mock 구현에서는 실제 의미 분석 대신 길이를 기준으로 정답 여부를 단순 판정합니다.
     * 화면 흐름 검증이 목적이므로 피드백 문구는 고정 텍스트를 사용합니다.
     */
    @Override
    public GradeResultDto gradeLearningAnswer(String question, String correctAnswer, String userAnswer, String explanation) {
        log.debug("[MockAI] 답안 채점 요청: question={}, explanation={}", question, explanation);

        boolean isCorrect = userAnswer != null && userAnswer.length() >= 50;
        int score = isCorrect ? 80 : 40;

        return new GradeResultDto(
                isCorrect,
                score,
                isCorrect
                        ? "핵심 개념은 잘 잡았습니다. 한 단계 더 구체적인 예시를 추가하면 더 좋은 답안이 됩니다."
                        : "핵심 개념 설명이 부족합니다. 정답과 해설을 참고해 다시 정리해 보세요.",
                correctAnswer
        );
    }

    /**
     * 문서 텍스트 추출 Mock
     *
     * [동작 방식]
     * 실제 파일 파싱 없이 고정 텍스트를 반환합니다.
     */
    @Override
    public String extractDocumentText(String filename, byte[] fileBytes, String contentType) {
        log.debug("[MockAI] 문서 텍스트 추출: filename={}", filename);
        return "[Mock 추출 텍스트] 파일명: " + filename + "\n\n"
                + "이 텍스트는 Mock 데이터입니다. "
                + "실제 Python AI 서버를 연결하면 PDF 또는 이미지에서 텍스트가 자동으로 추출됩니다.";
    }

    /**
     * 채용공고 URL 스크래핑 Mock
     *
     * [동작 방식]
     * 실제 URL 접근 없이 고정된 샘플 채용공고 데이터를 반환합니다.
     */
    @Override
    public JobPostingScrapedDto scrapeJobPosting(String url) {
        log.debug("[MockAI] 채용공고 스크래핑: url={}", url);
        return new JobPostingScrapedDto(
                "테크스타트업 Inc.",
                "백엔드 개발자 (Java/Spring Boot)",
                """
                [주요 업무]
                - Spring Boot 기반 REST API 설계 및 개발
                - 대용량 데이터 처리 시스템 구축 및 운영

                [자격 요건]
                - Java 백엔드 개발 경력 3년 이상
                - Spring Boot, JPA/Hibernate 실무 경험
                - MySQL/MariaDB 사용 경험

                [우대 사항]
                - AWS(EC2, RDS, S3) 운영 경험
                - MSA 설계 및 운영 경험
                - 코드 리뷰 문화에 익숙한 분

                [복지]
                - 자유로운 재택근무
                - 도서/교육비 지원
                - 최신 장비 지급
                """,
                "서울 강남구",
                "2026-04-30",
                url
        );
    }

    /**
     * 벡터 컬렉션 삭제 (Mock — 아무것도 하지 않음)
     *
     * [이유]
     * Mock 환경에서는 ChromaDB를 사용하지 않으므로 삭제 대상이 없습니다.
     * 인터페이스 계약을 지키기 위해 빈 구현을 제공합니다.
     */
    @Override
    public void deleteVectorCollection(String sessionId) {
        log.debug("[MockAI] 벡터 컬렉션 삭제 (Mock, 무시): sessionId={}", sessionId);
    }

    @Override
    public DailyPracticeResultDto evaluateDailyPractice(String question, String answer) {
        log.debug("[MockAI] 오늘의 연습질문 평가: question={}", question);
        boolean decent = answer != null && answer.length() >= 30;
        return new DailyPracticeResultDto(
                decent ? 75 : 40,
                decent
                        ? "핵심 키워드를 포함해 답변했습니다. 구체적인 경험 사례를 추가하면 더 설득력 있는 답변이 됩니다."
                        : "답변이 너무 짧습니다. 질문의 의도를 파악하고 구체적인 예시와 함께 답변해 보세요."
        );
    }

    /**
     * 요청 타입에 따라 실제 문제 타입을 결정합니다.
     * MIX는 짝수 인덱스는 객관식, 홀수 인덱스는 주관식으로 배치합니다.
     */
    private String resolveProblemType(String requestedType, int index) {
        if ("MULTIPLE".equals(requestedType) || "SHORT".equals(requestedType)) {
            return requestedType;
        }
        return index % 2 == 0 ? "MULTIPLE" : "SHORT";
    }

    /**
     * 객관식 문제 생성
     *
     * [주의]
     * 프론트엔드가 객관식일 때 choices를 반드시 기대하므로,
     * 이 메서드는 선택지 4개를 항상 채워서 반환해야 합니다.
     */
    private ProblemDto createMultipleProblem(String subject, String difficulty, int index) {
        String[] source = MOCK_MULTIPLE_POOL.get(index % MOCK_MULTIPLE_POOL.size());
        return new ProblemDto(
                "[" + subject + "] " + source[0],
                source[1],
                source[2],
                difficulty,
                List.of(source[3], source[4], source[5], source[6]),
                "MULTIPLE"
        );
    }

    /**
     * 주관식 문제 생성
     *
     * [동작 방식]
     * 주관식은 선택지가 필요 없으므로 ProblemDto의 편의 생성자를 사용합니다.
     */
    private ProblemDto createShortProblem(String subject, String difficulty, int index) {
        String[] source = MOCK_SHORT_POOL.get(index % MOCK_SHORT_POOL.size());
        return new ProblemDto(
                "[" + subject + "] " + source[0],
                source[1],
                source[2],
                difficulty
        );
    }
}
