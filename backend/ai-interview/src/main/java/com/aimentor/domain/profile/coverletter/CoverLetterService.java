package com.aimentor.domain.profile.coverletter;

import com.aimentor.common.BusinessException;
import com.aimentor.common.ErrorCode;
import com.aimentor.domain.profile.coverletter.dto.CoverLetterCreateRequestDto;
import com.aimentor.domain.profile.coverletter.dto.CoverLetterResponseDto;
import com.aimentor.domain.profile.coverletter.dto.CoverLetterUpdateRequestDto;
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
 * 자기소개서 비즈니스 로직 서비스
 * 보안: 수정/삭제 시 소유자 이메일 일치 여부 확인
 */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CoverLetterService {

    private final CoverLetterRepository coverLetterRepository;
    private final UserRepository userRepository;
    private final S3StorageService s3StorageService;
    private final AiService aiService;

    /** 내 자기소개서 목록 */
    public List<CoverLetterResponseDto> getMyCoverLetters(String email) {
        UserEntity user = getUser(email);
        return coverLetterRepository.findByUserIdOrderByCreatedAtDesc(user.getId())
                .stream()
                .map(CoverLetterResponseDto::from)
                .toList();
    }

    /** 자기소개서 단건 조회 (소유자만) */
    public CoverLetterResponseDto getCoverLetter(Long id, String email) {
        return CoverLetterResponseDto.from(getWithOwnerCheck(id, email));
    }

    /** 자기소개서 등록 (파일 선택) */
    @Transactional
    public CoverLetterResponseDto createCoverLetter(CoverLetterCreateRequestDto request,
                                                    MultipartFile file, String email) {
        UserEntity user = getUser(email);
        String fileUrl = s3StorageService.uploadFile(file, "cover-letters");
        String content = extractContentFromFile(file, request.content());

        CoverLetterEntity coverLetter = CoverLetterEntity.builder()
                .user(user)
                .title(request.title())
                .content(content)
                .fileUrl(fileUrl)
                .build();
        return CoverLetterResponseDto.from(coverLetterRepository.save(coverLetter));
    }

    /** 자기소개서 수정 (소유자만) */
    @Transactional
    public CoverLetterResponseDto updateCoverLetter(Long id, CoverLetterUpdateRequestDto request,
                                                    MultipartFile file, String email) {
        CoverLetterEntity coverLetter = getWithOwnerCheck(id, email);

        String content = (file != null && !file.isEmpty())
                ? extractContentFromFile(file, request.content())
                : request.content();

        coverLetter.update(request.title(), content);

        if (file != null && !file.isEmpty()) {
            s3StorageService.deleteFile(coverLetter.getFileUrl());
            coverLetter.updateFileUrl(s3StorageService.uploadFile(file, "cover-letters"));
        }

        return CoverLetterResponseDto.from(coverLetter);
    }

    /** 자기소개서 삭제 (소유자만) */
    @Transactional
    public void deleteCoverLetter(Long id, String email) {
        CoverLetterEntity coverLetter = getWithOwnerCheck(id, email);
        s3StorageService.deleteFile(coverLetter.getFileUrl());
        coverLetterRepository.delete(coverLetter);
    }

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
            log.warn("[CoverLetter] 파일 텍스트 추출 실패 — 기존 content 사용: {}", e.getMessage());
        }
        return fallbackContent;
    }

    private CoverLetterEntity getWithOwnerCheck(Long id, String email) {
        CoverLetterEntity coverLetter = coverLetterRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
        if (!coverLetter.getUser().getEmail().equals(email)) {
            throw new BusinessException(ErrorCode.FORBIDDEN);
        }
        return coverLetter;
    }

    private UserEntity getUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));
    }
}
