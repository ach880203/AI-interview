package com.aimentor.external.speech;

import org.springframework.web.multipart.MultipartFile;

/**
 * 음성 인식(STT) 서비스 추상화 인터페이스
 *
 * 구현체:
 * - MockSpeechService   : Mock 응답 (기본값, ai.service.mock=true)
 * - PythonSpeechService : Python Whisper 서버 실제 호출 (ai.service.mock=false)
 *
 * Python 서버 엔드포인트:
 * - POST /stt → speechToText()
 *
 * 참고 (TTS는 프론트 담당):
 *   브라우저 SpeechSynthesis API를 통해 클라이언트에서 직접 처리
 *   백엔드 TTS 구현 불필요
 *
 * 에러 처리:
 * - 서버 장애 시 AiServiceException(ErrorType.SPEECH) 발생
 * - GlobalExceptionHandler → 503 + SPEECH_SERVER_ERROR 응답
 */
public interface SpeechService {

    /**
     * 음성 파일 → 텍스트 변환 (Whisper STT)
     *
     * @param audioFile 사용자가 업로드한 음성 파일 (.webm, .mp3, .wav 등)
     * @return STT 변환된 텍스트 (면접 답변 answerText로 저장)
     *
     * 사용 위치:
     * - InterviewController: POST /api/interviews/sessions/{id}/answer
     *   (TODO: 현재 answerText를 직접 수신 → 실제 STT 연동 시 이 메서드 호출로 교체)
     */
    String speechToText(MultipartFile audioFile);
}
