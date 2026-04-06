package com.aimentor.external.speech;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

/**
 * STT 서비스 Mock 구현체
 *
 * 활성 조건: ai.service.mock=true (기본값)
 * Python Whisper 서버 없이 면접 답변 제출 흐름 테스트 가능
 *
 * Mock 동작:
 * - 파일명 + 고정 텍스트 반환 (실제 변환 없음)
 * - 음성 파일 null/비어있으면 기본 텍스트 반환
 */
@Slf4j
@Service
@ConditionalOnProperty(name = "ai.service.mock", havingValue = "true", matchIfMissing = true)
public class MockSpeechService implements SpeechService {

    @Override
    public String speechToText(MultipartFile audioFile) {
        if (audioFile == null || audioFile.isEmpty()) {
            log.debug("[MockSTT] 빈 파일 → 기본 텍스트 반환");
            return "[Mock] 음성 파일이 없습니다.";
        }

        log.debug("[MockSTT] 파일 수신: name={}, size={}", audioFile.getOriginalFilename(), audioFile.getSize());
        return "[Mock STT] 파일명: " + audioFile.getOriginalFilename() + " → 변환된 텍스트입니다.";
    }
}
