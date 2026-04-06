import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import * as interviewApi from '../../api/interview';
import AiWorkStatusCard from '../../components/common/AiWorkStatusCard';
import FeedbackCard from '../../components/interview/FeedbackCard';
import QuestionCard from '../../components/interview/QuestionCard';
import RecordButton from '../../components/interview/RecordButton';
import Button from '../../components/ui/Button';

/**
 * 면접 진행 페이지 (/interview/session/:sessionId)
 *
 * [역할]
 * AI 면접관이 질문하고 사용자가 음성으로 답변하는 화면입니다.
 * SpeechSynthesis(TTS)로 질문을 자동 음성 출력하고,
 * RecordButton이 MediaRecorder로 사용자 답변을 녹음합니다.
 *
 * [세션 진입 방식 — T2-5 새로고침 복구]
 * 1. 정상 진입 (InterviewSetupPage에서 navigate): location.state에 firstQuestion이 있으면 즉시 시작
 * 2. 새로고침 / 직접 URL 접근: API로 세션 상태를 복원합니다.
 *    - 세션이 COMPLETED이면 결과 페이지로 리다이렉트
 *    - 진행 중이면 미답변 질문 중 가장 앞 번호부터 이어서 시작
 *
 * [STT 흐름 — T2-1]
 * "답변 제출" 클릭 시:
 * 1. audioBlob이 있으면 POST /sessions/{id}/speech로 Whisper STT 변환 요청
 * 2. 변환 텍스트를 answerText로 사용
 * 3. STT 실패 시 SpeechRecognition transcript(있는 경우) 또는 직접 입력 모드로 전환
 *
 * [중도 종료]
 * 헤더 "그만두기" 버튼 → 0개 답변이면 안내 후 설정 화면으로, 1개 이상이면 부분 평가 가능
 */
export default function InterviewSessionPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { sessionId: urlSessionId } = useParams(); // URL 파라미터에서 세션 ID 추출 (T2-5)

  const locationState = location.state;

  // URL sessionId와 state sessionId 중 하나를 사용 (URL 우선)
  const sessionId = urlSessionId ?? locationState?.sessionId;

  // ── 컴포넌트 상태 ──────────────────────────────────────────────

  // 현재 표시 중인 질문 객체 { id, orderNum, question }
  const [currentQuestion, setCurrentQuestion] = useState(
    locationState?.firstQuestion ?? null
  );
  // 세션 복구 중 로딩 여부 (새로고침 접근 시)
  const [restoring, setRestoring] = useState(!locationState?.firstQuestion);
  // RecordButton에서 전달받은 녹음 파일 Blob
  const [audioBlob, setAudioBlob] = useState(null);
  // 음성 녹음 시간 (초 단위, 직접 입력 시 null)
  const [answerDuration, setAnswerDuration] = useState(null);
  // SpeechRecognition 인식 텍스트 (미리보기 전용)
  const [transcript, setTranscript] = useState('');
  // 답변 입력 방식: 음성 또는 직접 입력
  const [answerInputMode, setAnswerInputMode] = useState('voice');
  // 직접 입력 답변값
  const [typedAnswer, setTypedAnswer] = useState('');
  // STT 변환 중 여부 (Whisper 요청 대기)
  const [convertingSpeech, setConvertingSpeech] = useState(false);
  // STT 실패로 직접 입력 모드로 전환됐는지 안내하는 상태
  const [showTextFallbackNotice, setShowTextFallbackNotice] = useState(false);
  // 마지막 답변 후 종료 버튼 표시 여부
  const [canEnd, setCanEnd] = useState(false);
  // TTS 출력 중 여부
  const [isSpeaking, setIsSpeaking] = useState(false);
  // API 호출 상태
  const [submitting, setSubmitting] = useState(false);
  const [ending, setEnding] = useState(false);
  const [error, setError] = useState('');
  // 제출 완료한 답변 수 (중도 종료 안내에 사용)
  const [answeredCount, setAnsweredCount] = useState(0);
  // 전체 질문 수를 프런트 state로 들고 있으면 복구 시 백엔드 저장값으로 덮어쓸 수 있습니다.
  const [totalQuestionCount, setTotalQuestionCount] = useState(
    locationState?.totalQuestions ?? 5
  );
  // 중도 종료 확인 모달 표시 여부
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  // 질문 전환 시 RecordButton 내부 상태를 강제로 비우기 위한 신호
  const [recordResetSignal, setRecordResetSignal] = useState(0);

  // 이전 질문 텍스트 ref — 질문이 바뀔 때만 TTS 실행
  const prevQuestionRef = useRef('');
  // 현재 재생 중인 Audio 객체 ref — 컴포넌트 언마운트·질문 전환 시 정지
  const audioRef = useRef(null);

  // ── 세션 복구 (새로고침 / 직접 URL 접근 시) — T2-5 ────────────

  useEffect(() => {
    // sessionId가 없으면 설정 페이지로 이동
    if (!sessionId) {
      navigate('/interview/setup', { replace: true });
      return;
    }

    // location.state에 첫 질문이 있으면 즉시 시작 (정상 진입 경로)
    if (locationState?.firstQuestion) {
      setRestoring(false);
      return;
    }

    /**
     * API로 세션 상태를 복원합니다.
     *
     * [복원 로직]
     * 1. GET /api/interviews/sessions/{id} 로 세션 + Q&A 목록 조회
     * 2. 세션이 COMPLETED → 결과 페이지로 이동
     * 3. answerText가 null인 첫 번째 질문을 현재 질문으로 설정
     * 4. 모든 질문이 answered → canEnd=true
     */
    async function restoreSession() {
      try {
        const { data } = await interviewApi.getSessionDetail(sessionId);
        const session = data.data;

        // 이미 완료된 세션에 재진입 시 결과 페이지로 이동
        if (session.status === 'COMPLETED') {
          navigate(`/interview/result/${sessionId}`, { replace: true });
          return;
        }

        const qaList = session.qaList ?? [];
        const answeredList = qaList.filter((qa) => qa.answerText != null);
        const unansweredList = qaList.filter((qa) => qa.answerText == null);
        const restoredAnsweredQuestionCount =
          session.answeredQuestionCount ?? answeredList.length;
        const restoredTotalQuestionCount =
          session.plannedQuestionCount ?? Math.max(5, qaList.length);

        setAnsweredCount(restoredAnsweredQuestionCount);
        setTotalQuestionCount(restoredTotalQuestionCount);

        if (unansweredList.length === 0) {
          // 모든 질문에 답변 완료 → 종료 버튼 표시
          setCanEnd(true);
          // 마지막 질문을 현재 질문으로 표시 (컨텍스트 유지)
          setCurrentQuestion(qaList[qaList.length - 1]);
        } else {
          // 첫 미답변 질문부터 이어서 진행
          setCurrentQuestion(unansweredList[0]);
        }
      } catch {
        // 세션 복원 실패 시 설정 페이지로 이동
        navigate('/interview/setup', { replace: true });
      } finally {
        setRestoring(false);
      }
    }

    restoreSession();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // ── TTS ───────────────────────────────────────────────────────

  /**
   * 브라우저 SpeechSynthesis로 질문을 읽어줍니다. (폴백 전용)
   *
   * [Chrome voices 비동기 로딩 버그 대응]
   * Chrome은 getVoices()가 비동기로 로드됩니다.
   * 페이지 진입 직후 voices 목록이 비어있는 상태에서 speak()를 호출하면 조용히 실패합니다.
   * onvoiceschanged 이벤트를 기다렸다가 speak()를 호출해 첫 질문도 정상 출력합니다.
   */
  const speakWithBrowser = useCallback((text) => {
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ko-KR';
    utterance.rate = 0.9;
    utterance.pitch = 1.0;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend   = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      // voices가 이미 로드된 경우 즉시 실행
      window.speechSynthesis.speak(utterance);
    } else {
      // voices 로드 대기 — 완료 후 단 한 번만 실행
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.onvoiceschanged = null;
        window.speechSynthesis.speak(utterance);
      };
    }
  }, []);

  /**
   * OpenAI TTS로 질문을 자연스럽게 읽어줍니다.
   *
   * [동작 방식]
   * 1. POST /api/tts/speak → MP3 Blob 수신
   * 2. URL.createObjectURL로 임시 URL 생성 후 Audio() 객체로 재생
   * 3. 실패 시 speakWithBrowser 폴백 (브라우저 SpeechSynthesis)
   *
   * [중복 실행 방지]
   * prevQuestionRef로 이전 질문과 동일하면 재실행하지 않습니다.
   */
  const speakQuestion = useCallback(async (text) => {
    if (!text || text === prevQuestionRef.current) return;
    prevQuestionRef.current = text;

    // 이전 재생 중단
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    window.speechSynthesis.cancel();

    setIsSpeaking(true);

    try {
      const res = await interviewApi.speakText(text);
      const audioUrl = URL.createObjectURL(res.data);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onended = () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(audioUrl);
        audioRef.current = null;
      };
      audio.onerror = () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(audioUrl);
        audioRef.current = null;
        // OpenAI TTS 재생 실패 → 브라우저 폴백
        speakWithBrowser(text);
      };

      audio.play();
    } catch {
      // OpenAI TTS API 호출 실패 → 브라우저 SpeechSynthesis 폴백
      setIsSpeaking(false);
      speakWithBrowser(text);
    }
  }, [speakWithBrowser]);

  // 질문이 변경될 때마다 TTS 실행 (복원 완료 후에도 동작)
  useEffect(() => {
    if (currentQuestion?.question && !restoring) {
      speakQuestion(currentQuestion.question);
    }
    // 언마운트 시 재생 중인 모든 오디오 정리
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      window.speechSynthesis.cancel();
    };
  }, [currentQuestion?.question, restoring, speakQuestion]);

  // ── 녹음 완료 콜백 ──────────────────────────────────────────────

  /**
   * RecordButton의 onStop 콜백
   * 녹음이 완료되면 blob과 SpeechRecognition transcript를 저장합니다.
   *
   * @param {Blob} blob   - 녹음 오디오 파일 (audio/webm)
   * @param {string} text - SpeechRecognition 인식 텍스트 (미리보기용)
   */
  const handleRecordStop = useCallback((blob, text, duration) => {
    setAudioBlob(blob);
    setTranscript(text);
    setAnswerDuration(duration ?? null);
    setTypedAnswer('');
    setShowTextFallbackNotice(false);
    setError('');
  }, []);

  /**
   * 사용자가 "다시 녹음"을 눌렀을 때 부모 상태도 함께 비웁니다.
   * 이 처리가 없으면 이전 녹음이 남아서 잘못 제출될 수 있습니다.
   */
  const handleRecordReset = useCallback(() => {
    setAudioBlob(null);
    setTranscript('');
    setAnswerDuration(null);
    setError('');
  }, []);

  /**
   * 질문이 바뀌거나 입력 방식을 전환할 때
   * 이전 답변 흔적이 다음 질문에 섞이지 않도록 관련 상태를 한 번에 초기화합니다.
   */
  const resetAnswerDraft = useCallback((nextMode = 'voice') => {
    setAudioBlob(null);
    setTranscript('');
    setAnswerDuration(null);
    setTypedAnswer('');
    setShowTextFallbackNotice(false);
    setAnswerInputMode(nextMode);
    setRecordResetSignal((previousSignal) => previousSignal + 1);
  }, []);

  /**
   * 음성과 직접 입력이 동시에 활성화되지 않게 입력 모드를 전환합니다.
   */
  const handleAnswerInputModeChange = useCallback((nextMode) => {
    resetAnswerDraft(nextMode);
    setError('');
  }, [resetAnswerDraft]);

  // ── 답변 제출 ─────────────────────────────────────────────────

  /**
   * 현재 질문에 대한 답변을 서버에 제출합니다.
   *
   * [answerText 결정 로직 — T2-1]
   * 1. audioBlob이 있으면 → POST /sessions/{id}/speech 로 Whisper STT 변환
   * 2. STT 실패 + SpeechRecognition transcript 있으면 → transcript 사용
   * 3. STT 실패 + transcript 없으면 → 텍스트 직접 입력 폴백 화면 표시
   * 4. 직접 입력 모드에서 제출 → typedAnswer 사용
   *
   * [응답 처리]
   * - hasNextQuestion=true  → 다음 질문으로 전환 + 녹음 상태 초기화
   * - hasNextQuestion=false → canEnd=true (종료 버튼 활성화)
   */
  const handleSubmitAnswer = async () => {
    const canSubmitTypedAnswer = answerInputMode === 'text' && typedAnswer.trim();
    const canSubmitVoiceAnswer = answerInputMode === 'voice' && (audioBlob || transcript.trim());

    if (!canSubmitTypedAnswer && !canSubmitVoiceAnswer) {
      setError(
        answerInputMode === 'text'
          ? '답변을 입력해주세요.'
          : '먼저 답변을 녹음해주세요.'
      );
      return;
    }

    setSubmitting(true);
    setError('');

    let answerText = '';

    if (answerInputMode === 'text') {
      answerText = typedAnswer.trim();
    } else if (audioBlob) {
      // ── STT 변환 시도 (T2-1) ──────────────────────────────────
      setConvertingSpeech(true);
      try {
        const { data } = await interviewApi.convertSpeech(sessionId, audioBlob);
        answerText = data.data.text?.trim() || '';
      } catch {
        // STT 변환 실패 시 폴백 처리
        if (transcript.trim()) {
          // SpeechRecognition 결과가 있으면 그대로 사용
          answerText = transcript.trim();
          setError('음성 변환 서버 오류로 브라우저 인식 결과를 사용합니다.');
        } else {
          // 음성 변환이 완전히 실패하면 직접 입력 모드로 전환합니다.
          setAnswerInputMode('text');
          setAudioBlob(null);
          setTranscript('');
          setShowTextFallbackNotice(true);
          setRecordResetSignal((previousSignal) => previousSignal + 1);
          setError('음성 변환에 실패했습니다. 직접 입력으로 이어서 답변해주세요.');
          setSubmitting(false);
          setConvertingSpeech(false);
          return;
        }
      } finally {
        setConvertingSpeech(false);
      }
    } else {
      // audioBlob 없이 SpeechRecognition transcript만 있는 경우
      answerText = transcript.trim();
    }

    try {
      const { data } = await interviewApi.submitAnswer(sessionId, {
        orderNum: currentQuestion.orderNum,
        answerText,
        audioUrl: null,
        answerDuration: answerInputMode === 'voice' ? answerDuration : null,
      });

      const result = data.data; // { hasNextQuestion, nextQuestion }
      const nextAnsweredCount = answeredCount + 1;
      setAnsweredCount(nextAnsweredCount);

      if (result.hasNextQuestion && result.nextQuestion) {
        // 다음 질문으로 전환 + 녹음 상태 초기화
        setCurrentQuestion(result.nextQuestion);
        resetAnswerDraft('voice');
      } else {
        // 마지막 답변 완료 → 종료 버튼 표시
        setCanEnd(true);
        resetAnswerDraft('voice');
      }

      setError('');
    } catch (err) {
      const msg =
        err.response?.data?.error?.message ?? '답변 제출 중 오류가 발생했습니다.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // ── 면접 종료 ─────────────────────────────────────────────────

  /**
   * 면접을 종료하고 AI 피드백을 생성합니다.
   * 정상 종료(전체 답변 완료)와 중도 종료 모두 이 함수를 사용합니다.
   */
  const handleEnd = async () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    window.speechSynthesis.cancel();
    setEnding(true);
    setShowExitConfirm(false);
    setError('');

    try {
      const { data } = await interviewApi.endSession(sessionId);
      const feedback = data.data;
      const completionInfo = {
        isPartial: answeredCount < totalQuestionCount,
        answeredQuestionCount: answeredCount,
        totalQuestionCount: totalQuestionCount,
      };

      navigate(`/interview/result/${sessionId}`, {
        state: { feedback, completionInfo },
      });
    } catch (err) {
      const msg =
        err.response?.data?.error?.message ?? '면접 종료 중 오류가 발생했습니다.';
      setError(msg);
      setEnding(false);
    }
  };

  // ── 중도 종료 요청 ──────────────────────────────────────────────

  /**
   * 헤더 "그만두기" 버튼 클릭 처리
   * 0개 답변과 부분 완료를 같은 확인 모달에서 분기 처리합니다.
   */
  const handleExitRequest = () => {
    setShowExitConfirm(true);
  };

  /**
   * 종료 확인 모달의 확인 버튼 처리
   * 0개 답변이면 점수 없이 설정 화면으로 돌아가고,
   * 1개 이상이면 지금까지 답변한 내용만 기준으로 부분 평가를 생성합니다.
   */
  const handleConfirmExit = () => {
    if (answeredCount === 0) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      window.speechSynthesis.cancel();
      navigate('/interview/setup', { replace: true });
      return;
    }

    handleEnd();
  };

  // ── 렌더링 ───────────────────────────────────────────────────

  // 세션 복구 중 로딩 화면
  if (restoring) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F0F7FF]">
        <div className="flex flex-col items-center gap-4">
          <span className="h-10 w-10 animate-spin rounded-full border-4 border-mentor-accent border-t-mentor-primary" />
          <p className="text-sm text-mentor-muted">면접 세션을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F0F7FF] px-4 py-8">
      <div className="mx-auto max-w-[780px] flex flex-col gap-6">

        {/* 페이지 헤더 */}
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-mentor-text">AI 모의 면접</h1>
          <div className="flex items-center gap-3">
            {/* 현재 진행 질문 번호 */}
            <span className="rounded-full bg-mentor-accent px-3 py-1 text-sm font-semibold text-mentor-primary">
              {canEnd ? totalQuestionCount : currentQuestion?.orderNum ?? 1} / {totalQuestionCount}
            </span>
            {/* 중도 종료 버튼 */}
            <button
              type="button"
              onClick={handleExitRequest}
              disabled={ending}
              className="rounded-lg border border-mentor-border px-3 py-1.5 text-sm text-mentor-muted transition hover:border-red-300 hover:bg-red-50 hover:text-red-600 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              그만두기
            </button>
          </div>
        </div>

        {/* 질문 카드 */}
        {currentQuestion && (
          <QuestionCard
            question={currentQuestion.question}
            orderNum={currentQuestion.orderNum}
            totalQuestions={totalQuestionCount}
            isSpeaking={isSpeaking}
          />
        )}

        {!canEnd && (
          <div className="rounded-xl border border-mentor-primary/10 bg-mentor-surface px-4 py-3 text-xs leading-relaxed text-mentor-muted">
            AI 음성 출력까지 약간의 시간이 걸릴 수 있습니다. 질문 카드의 음성 표시가 사라질 때까지 잠시만 기다려주세요.
          </div>
        )}

        {/* 오류 메시지 */}
        {error && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {submitting && convertingSpeech && (
          <AiWorkStatusCard
            compact
            title="AI가 답변 음성을 정리하고 있습니다."
            description="녹음한 답변을 텍스트로 변환한 뒤 다음 단계로 넘기고 있습니다."
            hint="음성 길이에 따라 조금 더 걸릴 수 있습니다."
          />
        )}

        {submitting && !convertingSpeech && !ending && (
          <AiWorkStatusCard
            compact
            title="AI가 다음 질문을 준비하고 있습니다."
            description="방금 제출한 답변을 바탕으로 이어질 질문을 만들고 있습니다."
            hint="질문이 바뀌면 녹음 상태는 자동으로 초기화됩니다."
          />
        )}

        {/* 면접 종료 대기 안내 */}
        {canEnd && (
          <FeedbackCard
            variant="success"
            icon="✅"
            title="모든 질문에 답변 완료"
            content="수고하셨습니다! 아래 버튼을 눌러 면접을 종료하고 AI 피드백을 받아보세요."
          />
        )}

        {/* 녹음 구역 — 종료 대기 중이 아닐 때만 표시 */}
        {!canEnd && (
          <motion.div
            className="rounded-[20px] bg-mentor-surface p-6 shadow-[var(--shadow-card)]"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-mentor-text">
                답변 입력 방식
              </h2>
              <div className="inline-flex rounded-2xl border border-mentor-border bg-mentor-bg p-1">
                <button
                  type="button"
                  onClick={() => handleAnswerInputModeChange('voice')}
                  className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
                    answerInputMode === 'voice'
                      ? 'bg-mentor-primary text-white shadow-sm'
                      : 'text-mentor-muted hover:text-mentor-primary'
                  }`}
                >
                  음성 답변
                </button>
                <button
                  type="button"
                  onClick={() => handleAnswerInputModeChange('text')}
                  className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
                    answerInputMode === 'text'
                      ? 'bg-mentor-primary text-white shadow-sm'
                      : 'text-mentor-muted hover:text-mentor-primary'
                  }`}
                >
                  직접 입력
                </button>
              </div>
            </div>

            <p className="mt-3 text-xs leading-relaxed text-mentor-muted">
              한 번에 한 가지 방식만 활성화됩니다. 다음 질문으로 넘어가면 녹음과 입력 내용이 모두 초기화됩니다.
            </p>

            {showTextFallbackNotice && (
              <div className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
                음성 변환이 불안정해 직접 입력 모드로 전환했습니다. 아래에 답변을 이어서 입력해주세요.
              </div>
            )}

            {answerInputMode === 'voice' ? (
              <div className="mt-5">
                <RecordButton
                  onStop={handleRecordStop}
                  onReset={handleRecordReset}
                  disabled={submitting || convertingSpeech}
                  resetSignal={recordResetSignal}
                />
              </div>
            ) : (
              <div className="mt-5 flex flex-col gap-2">
                <label className="text-xs font-medium text-mentor-muted">
                  직접 입력 답변
                </label>
                <textarea
                  value={typedAnswer}
                  onChange={(event) => {
                    setTypedAnswer(event.target.value);
                    if (error) {
                      setError('');
                    }
                  }}
                  placeholder="답변 내용을 자연스럽게 입력해주세요."
                  rows={6}
                  className="w-full resize-none rounded-2xl border border-mentor-border bg-mentor-bg px-4 py-3 text-sm leading-relaxed text-mentor-text outline-none transition focus:border-mentor-primary focus:ring-2 focus:ring-mentor-accent"
                />
              </div>
            )}
          </motion.div>
        )}

        {/* 액션 버튼 구역 */}
        <div className="flex flex-col gap-3">
          {/* 답변 제출 버튼 */}
          {!canEnd && (
            <Button
              onClick={handleSubmitAnswer}
              loading={submitting}
              fullWidth
              size="lg"
              disabled={
                answerInputMode === 'text'
                  ? !typedAnswer.trim()
                  : !audioBlob && !transcript.trim()
              }
            >
              {convertingSpeech
                ? '음성 변환 중...'
                : submitting
                ? '제출 중...'
                : '답변 제출 →'}
            </Button>
          )}

          {/* 면접 종료 버튼 */}
          {canEnd && (
            <Button onClick={handleEnd} loading={ending} fullWidth size="lg">
              {ending ? 'AI 피드백 생성 중...' : '면접 종료 및 피드백 받기'}
            </Button>
          )}
        </div>

        {/* 피드백 생성 중 로딩 안내 */}
        {ending && (
          <AiWorkStatusCard
            title="AI가 면접 결과를 정리하고 있습니다."
            description="지금까지 답변한 내용을 기준으로 점수와 피드백을 만들고 있습니다."
            hint="부분 완료로 종료한 경우에도 완료한 질문만 기준으로 평가합니다."
          />
        )}
      </div>

      {/* 중도 종료 확인 모달 */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-mentor-surface p-6 shadow-xl">
            <h2 className="text-base font-bold text-mentor-text">
              {answeredCount === 0 ? '면접을 그만둘까요?' : '지금까지 평가받을까요?'}
            </h2>
            <p className="mt-2 text-sm text-mentor-muted">
              {answeredCount === 0 ? (
                <>
                  아직 답변한 질문이 없어 점수와 피드백은 생성되지 않습니다.
                  <br />
                  지금 나가면 면접 설정 화면으로 돌아갑니다.
                </>
              ) : (
                <>
                  지금까지{' '}
                  <span className="font-semibold text-mentor-primary">{answeredCount}개</span>{' '}
                  질문에 답변했습니다.
                  <br />
                  완료한 답변만 기준으로 점수와 피드백을 만들고,
                  남은{' '}
                  <span className="font-semibold">{totalQuestionCount - answeredCount}개</span>{' '}
                  질문은 평가에 포함하지 않습니다.
                </>
              )}
            </p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setShowExitConfirm(false)}
                className="flex-1 rounded-xl border border-mentor-border py-2.5 text-sm font-medium text-mentor-muted transition hover:bg-mentor-bg"
              >
                계속하기
              </button>
              <button
                type="button"
                onClick={handleConfirmExit}
                className="flex-1 rounded-xl bg-red-500 py-2.5 text-sm font-semibold text-white transition hover:bg-red-600"
              >
                {answeredCount === 0 ? '설정으로 돌아가기' : '지금까지 평가받기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
