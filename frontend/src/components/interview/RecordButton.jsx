import { useEffect, useRef, useState } from 'react';

/**
 * 녹음 버튼 컴포넌트
 *
 * [역할]
 * MediaRecorder API를 사용해 마이크 음성을 녹음합니다.
 * 녹음 시작/중지 UI와 시간 타이머를 제공합니다.
 *
 * [동작 흐름]
 * 1. "녹음 시작" 클릭 → 마이크 권한 요청 → MediaRecorder 시작
 * 2. 녹음 중: 빨간 원 펄스 애니메이션 + 초 단위 타이머 표시
 * 3. "녹음 중지" 클릭 → recorder.stop() → ondataavailable로 Blob 수집 → onStop 콜백 호출
 * 4. "다시 녹음" 클릭 → 이전 녹음 폐기 후 다시 1번부터
 *
 * [Props]
 *   onStop(blob, transcript) - 녹음 완료 시 호출 (audioBlob, 인식된 텍스트)
 *   onReset                  - 사용자가 녹음을 폐기했을 때 부모 상태도 함께 초기화
 *   disabled                 - 버튼 비활성화 (API 호출 중 등)
 *   resetSignal              - 질문 전환처럼 바깥에서 강제로 녹음 상태를 초기화할 때 사용
 */
export default function RecordButton({
  onStop,
  onReset = () => {},
  disabled = false,
  resetSignal = 0,
}) {
  const [state, setState] = useState('idle');
  const [seconds, setSeconds] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [micError, setMicError] = useState('');

  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const recognitionRef = useRef(null);
  const transcriptRef = useRef('');
  const startTimeRef = useRef(null);

  function stopRecognition() {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
  }

  function stopMediaStream() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }

  /**
   * 질문이 바뀌거나 입력 방식을 전환할 때
   * 내부 녹음 상태가 그대로 남지 않도록 강제로 정리합니다.
   *
   * key 재마운트보다 prop 기반 초기화가 좋은 이유:
   * "외부 신호로 녹음을 비운다"는 의도가 코드에 직접 드러나기 때문입니다.
   */
  function resetRecordingUi() {
    clearInterval(timerRef.current);
    timerRef.current = null;
    stopRecognition();

    if (recorderRef.current) {
      recorderRef.current.ondataavailable = null;
      recorderRef.current.onstop = null;

      if (recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop();
      }

      recorderRef.current = null;
    }

    stopMediaStream();
    chunksRef.current = [];
    transcriptRef.current = '';
    startTimeRef.current = null;
    setTranscript('');
    setSeconds(0);
    setState('idle');
  }

  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      stopRecognition();

      if (recorderRef.current) {
        recorderRef.current.ondataavailable = null;
        recorderRef.current.onstop = null;

        if (recorderRef.current.state !== 'inactive') {
          recorderRef.current.stop();
        }

        recorderRef.current = null;
      }

      stopMediaStream();
    };
  }, []);

  useEffect(() => {
    if (resetSignal === 0) {
      return;
    }

    resetRecordingUi();
    setMicError('');
  }, [resetSignal]);

  function startRecognition() {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = 'ko-KR';
    recognition.continuous = true;
    recognition.interimResults = true;

    let finalText = '';

    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalText += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      const nextTranscript = finalText + interim;
      transcriptRef.current = nextTranscript;
      setTranscript(nextTranscript);
    };

    recognition.start();
    recognitionRef.current = recognition;
  }

  async function handleStart() {
    setMicError('');
    setTranscript('');
    transcriptRef.current = '';
    setSeconds(0);
    chunksRef.current = [];

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setMicError('마이크 권한이 필요합니다. 브라우저 설정에서 허용해주세요.');
      return;
    }

    streamRef.current = stream;
    const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
    recorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      const duration = startTimeRef.current
        ? Math.round((Date.now() - startTimeRef.current) / 1000)
        : null;
      stopMediaStream();
      onStop(blob, transcriptRef.current, duration);
      setState('done');
    };

    recorder.start(100);
    startTimeRef.current = Date.now();
    setState('recording');
    startRecognition();

    timerRef.current = setInterval(() => {
      setSeconds((prev) => prev + 1);
    }, 1000);
  }

  function handleStop() {
    clearInterval(timerRef.current);
    stopRecognition();
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop();
    }
  }

  function handleReset() {
    resetRecordingUi();
    setMicError('');
    onReset();
  }

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col items-center gap-6">

      {micError && (
        <div className="w-full rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
          {micError}
        </div>
      )}

      <div className="flex flex-col items-center gap-3">

        {/* idle — 빨간 마이크 버튼 */}
        {state === 'idle' && (
          <button
            onClick={handleStart}
            disabled={disabled}
            className="relative flex h-20 w-20 items-center justify-center rounded-full
                       bg-red-500 text-white shadow-lg transition
                       hover:bg-red-600 active:scale-95
                       disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="녹음 시작"
          >
            <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm0 2a2 2 0 0 0-2 2v6a2 2 0 0 0 4 0V5a2 2 0 0 0-2-2zM8 11a4 4 0 0 0 8 0h2a6 6 0 0 1-5 5.91V19h2v2H9v-2h2v-2.09A6 6 0 0 1 6 11h2z" />
            </svg>
          </button>
        )}

        {/* recording — 펄스 애니메이션 + 중지 버튼 */}
        {state === 'recording' && (
          <button
            onClick={handleStop}
            className="relative flex h-20 w-20 items-center justify-center rounded-full
                       bg-red-500 text-white shadow-lg transition active:scale-95"
            aria-label="녹음 중지"
          >
            <span className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-60" />
            <span className="h-6 w-6 rounded-sm bg-white" />
          </button>
        )}

        {/* done — 초록 체크 버튼 (다시 녹음) */}
        {state === 'done' && (
          <button
            onClick={handleReset}
            disabled={disabled}
            className="flex h-20 w-20 items-center justify-center rounded-full
                       bg-emerald-500 text-white shadow-lg transition
                       hover:bg-emerald-600 active:scale-95 disabled:opacity-50"
            aria-label="다시 녹음"
          >
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </button>
        )}

        {/* 상태 레이블 */}
        <span className="text-sm font-medium text-mentor-muted">
          {state === 'idle' && '마이크를 눌러 녹음 시작'}
          {state === 'recording' && (
            <span className="text-red-500 font-semibold">
              녹음 중 {formatTime(seconds)}
            </span>
          )}
          {state === 'done' && (
            <span className="text-emerald-600 font-semibold">녹음 완료 · 다시 녹음하려면 탭하세요</span>
          )}
        </span>
      </div>

      {/* 실시간 음성 인식 결과 */}
      {(state === 'recording' || state === 'done') && (
        <div className="w-full rounded-2xl border border-mentor-border bg-mentor-bg p-4 min-h-[80px]">
          <p className="text-xs font-semibold text-mentor-muted mb-2">인식된 답변</p>
          <p className="text-sm text-mentor-text leading-relaxed">
            {transcript || (
              <span className="text-mentor-muted italic">
                {state === 'recording' ? '말씀해주세요...' : '인식된 텍스트가 없습니다.'}
              </span>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
