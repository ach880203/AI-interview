package com.aimentor.domain.interview;

import com.aimentor.common.BusinessException;
import com.aimentor.common.ErrorCode;
import com.aimentor.domain.interview.dto.*;
import com.aimentor.domain.profile.coverletter.CoverLetterEntity;
import com.aimentor.domain.profile.coverletter.CoverLetterRepository;
import com.aimentor.domain.profile.jobposting.JobPostingEntity;
import com.aimentor.domain.profile.jobposting.JobPostingRepository;
import com.aimentor.domain.profile.resume.ResumeEntity;
import com.aimentor.domain.profile.resume.ResumeRepository;
import com.aimentor.domain.user.UserEntity;
import com.aimentor.domain.user.UserRepository;
import com.aimentor.external.ai.AiService;
import com.aimentor.external.ai.dto.FeedbackDto;
import com.aimentor.external.speech.SpeechService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

/**
 * 면접 비즈니스 로직 서비스
 *
 * [역할]
 * 면접 세션의 전체 생명주기를 관리합니다.
 * 세션 생성, 질문 생성, 답변 저장, 피드백 생성까지의 흐름을 담당합니다.
 *
 * [면접 진행 흐름]
 * 1. startSession()  → 세션 생성 + 이력서/자소서/채용공고 내용을 AI에 전달 + 첫 질문 반환
 * 2. submitAnswer()  → 답변 저장 + 이전 Q&A 히스토리와 프로필 문서를 AI에 전달 + 다음 질문 반환
 * 3. endSession()    → 세션 종료 + 전체 히스토리 기반 피드백 생성 반환
 * 4. getFeedback()   → 저장된 피드백 조회
 *
 * [맞춤형 질문 생성 원리]
 * 사용자가 면접 설정에서 선택한 이력서, 자기소개서, 채용공고의 실제 본문(content)을
 * AI 서비스에 전달합니다. AI는 이 문서를 참고해 지원자 맞춤형 질문을 생성합니다.
 * 문서를 선택하지 않은 경우(ID가 null)에는 해당 필드를 null로 전달하여
 * AI가 일반적인 면접 질문을 생성하도록 합니다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class InterviewService {

    private static final int MAX_QUESTIONS = 5;

    private final InterviewRepository interviewRepository;
    private final InterviewQaRepository qaRepository;
    private final InterviewFeedbackRepository feedbackRepository;
    private final UserRepository userRepository;
    private final ResumeRepository resumeRepository;
    private final CoverLetterRepository coverLetterRepository;
    private final JobPostingRepository jobPostingRepository;
    private final AiService aiService;
    private final SpeechService speechService;

    // ──────────────────────────────────────────────────────
    // 1. 세션 시작
    // ──────────────────────────────────────────────────────

    /**
     * 면접 세션을 시작하고 첫 번째 질문을 생성합니다.
     *
     * [동작 방식]
     * 1. 세션 엔티티를 생성하고 선택된 문서 ID를 저장합니다.
     * 2. 이력서, 자기소개서, 채용공고의 실제 본문을 조회합니다.
     * 3. 조회한 내용을 AI 서비스에 전달하여 맞춤형 첫 질문을 생성합니다.
     * 4. 세션 정보와 첫 질문을 함께 반환합니다.
     *
     * [주의]
     * 문서 ID가 null이면 해당 문서 없이 면접을 진행합니다.
     * AI는 전달받은 문서가 있을 때만 해당 내용을 참고합니다.
     *
     * @param email   현재 로그인한 사용자 이메일
     * @param request 세션 시작 요청 (이력서/자소서/채용공고 ID)
     * @return 세션 정보 + 첫 질문
     */
    @Transactional
    public SessionStartResponseDto startSession(String email, SessionStartRequestDto request) {
        UserEntity user = getUser(email);
        String positionTitle = loadPositionTitle(request.jobPostingId(), user.getId());

        InterviewSessionEntity session = InterviewSessionEntity.builder()
                .user(user)
                .resumeId(request.resumeId())
                .coverLetterId(request.coverLetterId())
                .jobPostingId(request.jobPostingId())
                .positionTitle(positionTitle)
                .questionType(request.questionType())
                .startedAt(LocalDateTime.now())
                // 전체 질문 수를 세션에 같이 저장해 두면 결과 복원 시 프런트 임시 계산을 줄일 수 있습니다.
                .plannedQuestionCount(MAX_QUESTIONS)
                .build();

        interviewRepository.save(session);

        // 선택된 문서의 실제 본문을 소유자 확인 후 조회하여 AI에 전달
        String resumeContent = loadResumeContent(request.resumeId(), user.getId());
        String coverLetterContent = loadCoverLetterContent(request.coverLetterId(), user.getId());
        String jobDescription = loadJobDescription(request.jobPostingId(), user.getId());

        // sessionId를 문자열로 변환해 Python AI 서버 RAG 벡터 검색에 사용
        String firstQuestion = aiService.generateInterviewQuestion(
                resumeContent, coverLetterContent, jobDescription, "", request.questionType(),
                session.getId().toString());
        InterviewQaEntity firstQa = createQa(session, 1, firstQuestion);
        log.info("면접 세션 시작: sessionId={}, userId={}, resumeId={}, coverLetterId={}, jobPostingId={}",
                session.getId(), user.getId(), request.resumeId(), request.coverLetterId(), request.jobPostingId());

        return SessionStartResponseDto.of(session, QaResponseDto.from(firstQa));
    }

    // ──────────────────────────────────────────────────────
    // 2. 세션 목록 조회
    // ──────────────────────────────────────────────────────

    /** 내 면접 세션 목록 (최신순) — 이력서명·채용공고 회사/포지션 포함 */
    public List<SessionSummaryResponseDto> getSessions(String email) {
        UserEntity user = getUser(email);

        List<InterviewSessionEntity> sessions = interviewRepository.findByUserIdOrderByStartedAtDesc(user.getId());
        List<Long> completedSessionIds = sessions.stream()
                .filter(session -> session.getStatus() == InterviewSessionEntity.SessionStatus.COMPLETED)
                .map(InterviewSessionEntity::getId)
                .toList();

        Set<Long> feedbackReadySessionIds = completedSessionIds.isEmpty()
                ? Set.of()
                : new HashSet<>(feedbackRepository.findExistingSessionIds(completedSessionIds));

        // 이력서 이름 배치 조회 (N+1 방지)
        Set<Long> resumeIds = sessions.stream()
                .map(InterviewSessionEntity::getResumeId)
                .filter(id -> id != null)
                .collect(Collectors.toSet());
        Map<Long, String> resumeNames = resumeIds.isEmpty()
                ? new HashMap<>()
                : resumeRepository.findAllById(resumeIds).stream()
                        .collect(Collectors.toMap(
                                com.aimentor.domain.profile.resume.ResumeEntity::getId,
                                com.aimentor.domain.profile.resume.ResumeEntity::getTitle));

        // 채용공고 회사명·포지션 배치 조회
        Set<Long> jobPostingIds = sessions.stream()
                .map(InterviewSessionEntity::getJobPostingId)
                .filter(id -> id != null)
                .collect(Collectors.toSet());
        Map<Long, com.aimentor.domain.profile.jobposting.JobPostingEntity> jobPostings = jobPostingIds.isEmpty()
                ? new HashMap<>()
                : jobPostingRepository.findAllById(jobPostingIds).stream()
                        .collect(Collectors.toMap(
                                com.aimentor.domain.profile.jobposting.JobPostingEntity::getId,
                                Function.identity()));

        return sessions.stream()
                .map(session -> {
                    String resumeName = session.getResumeId() != null
                            ? resumeNames.get(session.getResumeId()) : null;
                    com.aimentor.domain.profile.jobposting.JobPostingEntity jp =
                            session.getJobPostingId() != null ? jobPostings.get(session.getJobPostingId()) : null;
                    return SessionSummaryResponseDto.from(
                            session,
                            feedbackReadySessionIds.contains(session.getId()),
                            resumeName,
                            jp != null ? jp.getCompany() : null,
                            jp != null ? jp.getPosition() : null);
                })
                .toList();
    }

    // ──────────────────────────────────────────────────────
    // 오답노트 — 완료된 면접 Q&A 전체 조회
    // ──────────────────────────────────────────────────────

    /**
     * 사용자의 완료된 면접 세션에서 모든 Q&A를 조회합니다.
     * 오답노트에서 면접 질문을 다시 연습할 수 있게 합니다.
     *
     * @param email 현재 로그인한 사용자 이메일
     * @return 면접 Q&A 복습 목록
     */
    public List<InterviewQaReviewDto> getQaHistory(String email) {
        UserEntity user = getUser(email);
        return qaRepository.findBySession_User_IdAndSession_StatusOrderByCreatedAtDesc(
                        user.getId(), InterviewSessionEntity.SessionStatus.COMPLETED)
                .stream()
                .filter(qa -> qa.getAnswerText() != null)
                .map(InterviewQaReviewDto::from)
                .toList();
    }

    // ──────────────────────────────────────────────────────
    // 3. 세션 상세 조회
    // ──────────────────────────────────────────────────────

    /** 세션 상세 + 전체 Q&A 목록 (소유자만) */
    public SessionDetailResponseDto getSessionDetail(Long sessionId, String email) {
        InterviewSessionEntity session = getSessionWithOwnerCheck(sessionId, email);

        List<QaResponseDto> qaList = qaRepository.findBySessionIdOrderByOrderNum(sessionId)
                .stream()
                .map(QaResponseDto::from)
                .toList();

        return SessionDetailResponseDto.of(session, qaList);
    }

    // ──────────────────────────────────────────────────────
    // 4. 답변 제출
    // ──────────────────────────────────────────────────────

    /**
     * 답변을 저장하고 다음 질문을 생성합니다.
     *
     * [동작 방식]
     * 1. 세션 소유자를 확인하고 진행 중인 세션인지 검증합니다.
     * 2. 해당 질문 번호의 Q&A에 답변을 저장합니다.
     * 3. 아직 질문이 남았으면 이전 대화 히스토리와 프로필 문서를 AI에 전달해
     *    맥락을 이어가는 후속 질문을 생성합니다.
     * 4. 마지막 질문이면 종료 가능 상태를 반환합니다.
     *
     * [왜 프로필 문서를 매번 전달하는가]
     * AI가 이력서/자소서/채용공고 내용을 매 질문에서 참고해야
     * "이력서에 적힌 프로젝트에 대해 더 자세히 설명해주세요" 같은
     * 맥락 있는 꼬리질문이 가능합니다.
     *
     * @param sessionId 세션 ID
     * @param request   답변 제출 정보 (질문 번호, 답변 텍스트, 오디오 URL)
     * @param email     현재 로그인한 사용자 이메일
     * @return 다음 질문 정보 또는 종료 가능 상태
     */
    @Transactional
    public AnswerResponseDto submitAnswer(Long sessionId, AnswerSubmitRequestDto request, String email) {
        InterviewSessionEntity session = getSessionWithOwnerCheck(sessionId, email);

        if (session.getStatus() == InterviewSessionEntity.SessionStatus.COMPLETED) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "이미 종료된 면접 세션입니다.");
        }

        InterviewQaEntity currentQa = qaRepository
                .findBySessionIdAndOrderNum(sessionId, request.orderNum())
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));

        if (currentQa.getAnswerText() != null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "이미 답변한 질문입니다.");
        }

        currentQa.saveAnswer(request.answerText(), request.audioUrl(), request.answerDuration());
        // 답변 저장 직후 세션 진행률도 함께 갱신해 두면
        // 새로고침이나 중도 종료 뒤에도 "지금까지 몇 개 답했는지"를 정확히 복원할 수 있습니다.
        session.updateAnsweredQuestionCount(calculateAnsweredQuestionCount(sessionId));
        log.info("답변 저장: sessionId={}, orderNum={}", sessionId, request.orderNum());

        int nextOrderNum = request.orderNum() + 1;
        if (nextOrderNum <= MAX_QUESTIONS) {
            String history = buildHistory(sessionId);

            // 세션에 저장된 문서 ID로 소유자 확인 후 실제 본문을 조회하여 AI에 전달
            Long userId = session.getUser().getId();
            String resumeContent = loadResumeContent(session.getResumeId(), userId);
            String coverLetterContent = loadCoverLetterContent(session.getCoverLetterId(), userId);
            String jobDescription = loadJobDescription(session.getJobPostingId(), userId);

            String nextQuestion = aiService.generateInterviewQuestion(
                    resumeContent, coverLetterContent, jobDescription, history, session.getQuestionType(),
                    sessionId.toString());
            InterviewQaEntity nextQa = createQa(session, nextOrderNum, nextQuestion);
            return AnswerResponseDto.withNext(QaResponseDto.from(nextQa));
        }

        return AnswerResponseDto.noMore();
    }

    // ──────────────────────────────────────────────────────
    // 5. 면접 종료
    // ──────────────────────────────────────────────────────

    /**
     * 면접을 종료하고 AI 피드백을 생성합니다.
     *
     * [동작 방식]
     * 1. 세션 상태를 COMPLETED로 변경하고 종료 시각을 기록합니다.
     * 2. 전체 Q&A 히스토리를 AI 서비스에 전달하여 피드백을 생성합니다.
     * 3. 피드백 결과(논리성/관련성/구체성 점수 + 텍스트 피드백)를 DB에 저장합니다.
     *
     * @param sessionId 세션 ID
     * @param email     현재 로그인한 사용자 이메일
     * @return 피드백 응답
     */
    @Transactional
    public FeedbackResponseDto endSession(Long sessionId, String email) {
        InterviewSessionEntity session = getSessionWithOwnerCheck(sessionId, email);

        if (session.getStatus() == InterviewSessionEntity.SessionStatus.COMPLETED) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "이미 종료된 면접 세션입니다.");
        }

        // 세션 종료
        int answeredQuestionCount = calculateAnsweredQuestionCount(sessionId);
        boolean partialCompleted = answeredQuestionCount < session.getPlannedQuestionCount();

        // 세션 종료 시점에 최종 답변 수와 부분 완료 여부를 함께 저장합니다.
        session.complete(partialCompleted, answeredQuestionCount);
        log.info("면접 종료: sessionId={}", sessionId);

        // AI 피드백 생성 (MockAiService 또는 PythonAiService)
        String history = buildHistory(sessionId);
        String timingAnalysis = buildTimingAnalysis(sessionId);
        // 채용공고 키워드 분석을 위해 세션에 연결된 채용공고 본문을 조회합니다.
        // jobPostingId가 없거나 소유자 불일치 시 null을 반환하며, AI는 채용공고 없이 키워드 분석을 건너뜁니다.
        Long userId = session.getUser().getId();
        String jobDescription = loadJobDescription(session.getJobPostingId(), userId);
        FeedbackDto feedbackDto = aiService.generateFeedback(history, timingAnalysis, jobDescription);

        InterviewFeedbackEntity feedback = InterviewFeedbackEntity.builder()
                .session(session)
                .logicScore(feedbackDto.logicScore())
                .relevanceScore(feedbackDto.relevanceScore())
                .specificityScore(feedbackDto.specificityScore())
                .communicationScore(feedbackDto.communicationScore())
                .professionalismScore(feedbackDto.professionalismScore())
                .overallScore(feedbackDto.overallScore())
                .strengths(feedbackDto.strengths())
                .weakPoints(feedbackDto.weakPoints())
                .improvements(feedbackDto.improvements())
                .questionFeedbacks(feedbackDto.questionFeedbacks())
                .attitudeScore(feedbackDto.attitudeScore())
                .attitudeFeedback(feedbackDto.attitudeFeedback())
                .starScore(feedbackDto.starScore())
                .consistencyScore(feedbackDto.consistencyScore())
                .consistencyFeedback(feedbackDto.consistencyFeedback())
                .recommendedAnswer(feedbackDto.recommendedAnswer())
                .timingAnalysis(feedbackDto.timingAnalysis())
                .keywordAnalysis(feedbackDto.keywordAnalysis())
                .build();

        feedbackRepository.save(feedback);

        // 면접 완료 후 ChromaDB 벡터 컬렉션 정리
        // 피드백 저장이 완료된 이후에 삭제해야 벡터 검색이 필요한 모든 작업이 끝난 상태입니다.
        // 삭제 실패는 면접 결과에 영향을 주지 않으므로 aiService 내부에서 예외를 삼킵니다.
        aiService.deleteVectorCollection(session.getId().toString());

        return FeedbackResponseDto.from(feedback);
    }

    // ──────────────────────────────────────────────────────
    // 6. 성장 추적 — 회차별 점수 목록
    // ──────────────────────────────────────────────────────

    /**
     * 사용자의 완료된 면접 세션 전체 점수를 시간순으로 반환합니다.
     * 단일 쿼리로 N+1 문제를 방지하며, 프론트엔드 차트에서 직접 사용합니다.
     *
     * @param email 현재 로그인한 사용자 이메일
     * @return 회차별 점수 목록
     */
    public GrowthReportDto getGrowthReport(String email) {
        UserEntity user = getUser(email);
        List<InterviewFeedbackEntity> feedbacks = feedbackRepository
                .findBySession_User_IdAndSession_StatusOrderBySession_StartedAtAsc(
                        user.getId(), InterviewSessionEntity.SessionStatus.COMPLETED);

        List<GrowthReportDto.SessionScoreDto> sessions = IntStream.range(0, feedbacks.size())
                .mapToObj(i -> GrowthReportDto.SessionScoreDto.from(feedbacks.get(i), i + 1))
                .toList();

        return new GrowthReportDto(sessions);
    }

    // ──────────────────────────────────────────────────────
    // 7. 피드백 조회
    // ──────────────────────────────────────────────────────

    /**
     * 저장된 면접 피드백을 조회합니다.
     * 면접 종료 후에만 조회 가능하며, 세션 소유자만 접근할 수 있습니다.
     */
    public FeedbackResponseDto getFeedback(Long sessionId, String email) {
        getSessionWithOwnerCheck(sessionId, email); // 소유자 확인

        return feedbackRepository.findBySessionId(sessionId)
                .map(FeedbackResponseDto::from)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND,
                        "피드백이 아직 생성되지 않았습니다. 면접을 먼저 종료해주세요."));
    }

    // ──────────────────────────────────────────────────────
    // 7. 음성 → 텍스트 변환 (STT)
    // ──────────────────────────────────────────────────────

    /**
     * 음성 파일을 텍스트로 변환합니다. (Whisper STT)
     *
     * [동작 방식]
     * 1. 세션 소유자 확인 (타 사용자 요청 차단)
     * 2. Python Whisper 서버에 음성 파일 전달
     * 3. 변환된 텍스트 반환 → 프론트엔드가 answerText로 사용
     *
     * @param sessionId 세션 ID (소유자 확인용)
     * @param email     현재 로그인한 사용자 이메일
     * @param audioFile 변환할 음성 파일 (.webm, .mp3, .wav 등)
     * @return 변환된 텍스트
     */
    public String convertSpeech(Long sessionId, String email, MultipartFile audioFile) {
        getSessionWithOwnerCheck(sessionId, email); // 세션 소유자 확인
        return speechService.speechToText(audioFile);
    }

    // ──────────────────────────────────────────────────────
    // 내부 헬퍼
    // ──────────────────────────────────────────────────────

    /**
     * Q&A 히스토리 문자열 생성 (AI 서버 컨텍스트용)
     * 형식: "Q1: <질문>\nA1: <답변>\nQ2: <질문>\n..."
     */
    private String buildHistory(Long sessionId) {
        List<InterviewQaEntity> qaList = qaRepository.findBySessionIdOrderByOrderNum(sessionId);
        return qaList.stream()
                .map(qa -> {
                    String line = "Q" + qa.getOrderNum() + ": " + qa.getQuestion();
                    if (qa.getAnswerText() != null) {
                        line += "\nA" + qa.getOrderNum() + ": " + qa.getAnswerText();
                    }
                    return line;
                })
                .collect(Collectors.joining("\n"));
    }

    /**
     * 질문별 답변 시간 요약 문자열을 생성합니다.
     * 형식: "Q1: 45초 (짧음), Q2: 92초 (적당), Q3: 185초 (김)"
     *
     * 판정 기준:
     * - 30초 미만: 짧음
     * - 30~180초:  적당
     * - 180초 초과: 김
     */
    private String buildTimingAnalysis(Long sessionId) {
        List<InterviewQaEntity> qaList = qaRepository.findBySessionIdOrderByOrderNum(sessionId);

        StringBuilder sb = new StringBuilder();
        boolean hasAnyDuration = false;

        for (InterviewQaEntity qa : qaList) {
            if (qa.getAnswerDuration() == null) continue;
            hasAnyDuration = true;

            int secs = qa.getAnswerDuration();
            String label = secs < 30 ? "짧음" : secs > 180 ? "김" : "적당";

            if (!sb.isEmpty()) sb.append(", ");
            sb.append("Q").append(qa.getOrderNum()).append(": ").append(secs).append("초 (").append(label).append(")");
        }

        return hasAnyDuration ? sb.toString() : null;
    }

    /**
     * 답변이 실제로 저장된 질문 수를 계산합니다.
     * 생성된 질문 수와 답변 완료 수는 다를 수 있으므로 부분 완료 여부는 이 값을 기준으로 계산합니다.
     */
    private int calculateAnsweredQuestionCount(Long sessionId) {
        return qaRepository.countBySessionIdAndAnswerTextIsNotNull(sessionId);
    }

    private InterviewQaEntity createQa(InterviewSessionEntity session, int orderNum, String question) {
        return qaRepository.save(InterviewQaEntity.builder()
                .session(session)
                .orderNum(orderNum)
                .question(question)
                .build());
    }

    private InterviewSessionEntity getSessionWithOwnerCheck(Long sessionId, String email) {
        InterviewSessionEntity session = interviewRepository.findById(sessionId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
        if (!session.getUser().getEmail().equals(email)) {
            throw new BusinessException(ErrorCode.FORBIDDEN);
        }
        return session;
    }

    /**
     * 이력서 ID로 본문 내용을 조회합니다.
     * ID가 null이거나 소유자 불일치 시 null을 반환합니다.
     * null을 반환하면 AI는 이력서 없이 일반 질문을 생성합니다.
     *
     * @param resumeId 이력서 ID (nullable)
     * @param userId   소유자 ID — 타 사용자 문서 접근 방지
     * @return 이력서 본문 또는 null
     */
    private String loadResumeContent(Long resumeId, Long userId) {
        if (resumeId == null) {
            return null;
        }
        return resumeRepository.findByIdAndUserId(resumeId, userId)
                .map(ResumeEntity::getContent)
                .orElse(null);
    }

    /**
     * 자기소개서 ID로 본문 내용을 조회합니다.
     *
     * @param coverLetterId 자기소개서 ID (nullable)
     * @param userId        소유자 ID — 타 사용자 문서 접근 방지
     * @return 자기소개서 본문 또는 null
     */
    private String loadCoverLetterContent(Long coverLetterId, Long userId) {
        if (coverLetterId == null) {
            return null;
        }
        return coverLetterRepository.findByIdAndUserId(coverLetterId, userId)
                .map(CoverLetterEntity::getContent)
                .orElse(null);
    }

    /**
     * 채용공고 ID로 설명 내용을 조회합니다.
     *
     * @param jobPostingId 채용공고 ID (nullable)
     * @param userId       소유자 ID — 타 사용자 문서 접근 방지
     * @return 채용공고 설명 또는 null
     */
    private String loadJobDescription(Long jobPostingId, Long userId) {
        if (jobPostingId == null) {
            return null;
        }
        return jobPostingRepository.findByIdAndUserId(jobPostingId, userId)
                .map(JobPostingEntity::getDescription)
                .orElse(null);
    }

    /**
     * 면접 세션 제목으로 사용할 포지션명을 조회합니다.
     *
     * title / position_title 이중 컬럼이 섞여 있는 DB에서도
     * 사용자가 고른 채용공고의 직무명이 남도록 기본 제목을 채워 둡니다.
     */
    private String loadPositionTitle(Long jobPostingId, Long userId) {
        if (jobPostingId == null) {
            return "";
        }
        return jobPostingRepository.findByIdAndUserId(jobPostingId, userId)
                .map(JobPostingEntity::getPosition)
                .orElse("");
    }

    private UserEntity getUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));
    }
}
