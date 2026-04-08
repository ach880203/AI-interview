package com.aimentor.domain.profile.resume;

import com.aimentor.common.BusinessException;
import com.aimentor.common.ErrorCode;
import com.aimentor.domain.profile.resume.dto.ResumeCreateRequestDto;
import com.aimentor.domain.profile.resume.dto.ResumeResponseDto;
import com.aimentor.domain.profile.resume.dto.ResumeUpdateRequestDto;
import com.aimentor.domain.user.UserEntity;
import com.aimentor.domain.user.UserRepository;
import com.aimentor.external.ai.AiService;
import com.aimentor.external.storage.S3StorageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

/**
 * 이력서 비즈니스 로직 서비스
 *
 * 보안 정책:
 * - 모든 쓰기 작업(수정/삭제)은 소유자 확인 후 진행
 * - 타인의 이력서 접근 시 FORBIDDEN 예외 발생
 */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ResumeService {

    private final ResumeRepository resumeRepository;
    private final UserRepository userRepository;
    private final S3StorageService s3StorageService;
    private final AiService aiService;

    /** 내 이력서 목록 조회 */
    public List<ResumeResponseDto> getMyResumes(String email) {
        UserEntity user = getUser(email);
        return resumeRepository.findByUserIdOrderByCreatedAtDesc(user.getId())
                .stream()
                .map(ResumeResponseDto::from)
                .toList();
    }

    /** 이력서 단건 조회 (소유자만) */
    public ResumeResponseDto getResume(Long resumeId, String email) {
        ResumeEntity resume = getResumeWithOwnerCheck(resumeId, email);
        return ResumeResponseDto.from(resume);
    }

    /**
     * 이력서 등록
     *
     * 파일이 첨부된 경우 AI 서버에서 텍스트를 추출해 content로 저장합니다.
     * 추출 실패 시 사용자가 입력한 content를 그대로 사용합니다.
     *
     * @param file 파일 첨부 (선택, multipart) — PDF 또는 이미지
     */
    @Transactional
    public ResumeResponseDto createResume(ResumeCreateRequestDto request, MultipartFile file, String email) {
        UserEntity user = getUser(email);
        String originalFileName = (file != null && !file.isEmpty()) ? file.getOriginalFilename() : null;
        String fileUrl = s3StorageService.uploadFile(file, "resumes");
        String content = extractContentFromFile(file, request.content());

        ResumeEntity resume = ResumeEntity.builder()
                .user(user)
                .title(request.title())
                .content(content)
                .fileUrl(fileUrl)
                .originalFileName(originalFileName)
                .build();

        return ResumeResponseDto.from(resumeRepository.save(resume));
    }

    /**
     * 이력서 수정 (소유자만)
     *
     * 새 파일이 첨부된 경우 텍스트를 재추출해 content를 갱신합니다.
     *
     * @param file 파일 교체 (선택: null이면 기존 파일 유지)
     */
    @Transactional
    public ResumeResponseDto updateResume(Long resumeId, ResumeUpdateRequestDto request,
                                       MultipartFile file, String email) {
        ResumeEntity resume = getResumeWithOwnerCheck(resumeId, email);

        String content = (file != null && !file.isEmpty())
                ? extractContentFromFile(file, request.content())
                : request.content();

        resume.update(request.title(), content);

        if (file != null && !file.isEmpty()) {
            s3StorageService.deleteFile(resume.getFileUrl());
            resume.updateFileUrl(
                s3StorageService.uploadFile(file, "resumes"),
                file.getOriginalFilename()
            );
        }

        return ResumeResponseDto.from(resume);
    }

    /**
     * 이력서 삭제 (소유자만)
     * S3 파일도 함께 삭제
     */
    @Transactional
    public void deleteResume(Long resumeId, String email) {
        ResumeEntity resume = getResumeWithOwnerCheck(resumeId, email);
        s3StorageService.deleteFile(resume.getFileUrl());
        resumeRepository.delete(resume);
    }

    // ── 내부 헬퍼 ──────────────────────────────────

    /**
     * 파일이 있으면 AI로 텍스트를 추출하고, 실패하면 fallback content를 반환합니다.
     */
    private String extractContentFromFile(MultipartFile file, String fallbackContent) {
        if (file == null || file.isEmpty()) {
            return fallbackContent;
        }
        try {
            String extracted = aiService.extractDocumentText(
                    file.getOriginalFilename(),
                    file.getBytes(),
                    file.getContentType() != null ? file.getContentType() : "application/octet-stream"
            );
            if (extracted != null && !extracted.isBlank()) {
                return extracted;
            }
        } catch (Exception e) {
            log.warn("[Resume] 파일 텍스트 추출 실패 — 기존 content 사용: {}", e.getMessage());
        }
        return fallbackContent;
    }

    /** 소유자 확인 후 이력서 반환 (아니면 FORBIDDEN) */
    private ResumeEntity getResumeWithOwnerCheck(Long resumeId, String email) {
        ResumeEntity resume = resumeRepository.findById(resumeId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));

        if (!resume.getUser().getEmail().equals(email)) {
            throw new BusinessException(ErrorCode.FORBIDDEN);
        }
        return resume;
    }

    private UserEntity getUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));
    }
}
