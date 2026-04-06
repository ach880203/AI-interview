package com.aimentor.domain.profile.jobposting;

import com.aimentor.common.BusinessException;
import com.aimentor.common.ErrorCode;
import com.aimentor.domain.profile.jobposting.dto.JobPostingCreateRequestDto;
import com.aimentor.domain.profile.jobposting.dto.JobPostingResponseDto;
import com.aimentor.domain.profile.jobposting.dto.JobPostingUpdateRequestDto;
import com.aimentor.domain.user.UserEntity;
import com.aimentor.domain.user.UserRepository;
import com.aimentor.external.ai.AiService;
import com.aimentor.external.ai.dto.JobPostingScrapedDto;
import com.aimentor.external.storage.S3StorageService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.util.List;

/**
 * 채용공고 비즈니스 로직 서비스
 * 보안: 수정/삭제 시 소유자 확인
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class JobPostingService {

    private final JobPostingRepository jobPostingRepository;
    private final UserRepository userRepository;
    private final S3StorageService s3StorageService;
    private final AiService aiService;

    /** 내 채용공고 목록 */
    public List<JobPostingResponseDto> getMyJobPostings(String email) {
        UserEntity user = getUser(email);
        return jobPostingRepository.findByUserIdOrderByCreatedAtDesc(user.getId())
                .stream()
                .map(JobPostingResponseDto::from)
                .toList();
    }

    /** 채용공고 단건 조회 (소유자만) */
    public JobPostingResponseDto getJobPosting(Long id, String email) {
        return JobPostingResponseDto.from(getWithOwnerCheck(id, email));
    }

    /** 채용공고 등록 */
    @Transactional
    public JobPostingResponseDto createJobPosting(JobPostingCreateRequestDto request,
                                               MultipartFile file, String email) {
        UserEntity user = getUser(email);
        String fileUrl = s3StorageService.uploadFile(file, "job-postings");

        JobPostingEntity jobPosting = JobPostingEntity.builder()
                .user(user)
                .company(request.company())
                .position(request.position())
                .description(request.description())
                .location(request.location())
                .fileUrl(fileUrl)
                .dueDate(request.dueDate())
                .build();

        return JobPostingResponseDto.from(jobPostingRepository.save(jobPosting));
    }

    /** 채용공고 수정 (소유자만) */
    @Transactional
    public JobPostingResponseDto updateJobPosting(Long id, JobPostingUpdateRequestDto request,
                                               MultipartFile file, String email) {
        JobPostingEntity jobPosting = getWithOwnerCheck(id, email);
        jobPosting.update(request.company(), request.position(), request.description(), request.location());
        jobPosting.updateDueDate(request.dueDate());

        if (file != null && !file.isEmpty()) {
            s3StorageService.deleteFile(jobPosting.getFileUrl());
            jobPosting.updateFileUrl(s3StorageService.uploadFile(file, "job-postings"));
        }

        return JobPostingResponseDto.from(jobPosting);
    }

    /**
     * URL 스크래핑으로 채용공고 등록
     *
     * [동작 방식]
     * Python AI 서버가 URL HTML을 가져와 GPT로 company/position/description을 추출합니다.
     * description 끝에 원본 URL을 항상 포함시켜 어디서 가져왔는지 확인할 수 있게 합니다.
     * sourceUrl 필드에도 별도 저장합니다 (Spring Boot 재시작 후 DB 컬럼 자동 생성).
     */
    @Transactional
    public JobPostingResponseDto createFromUrl(String url, String email) {
        UserEntity user = getUser(email);
        JobPostingScrapedDto scraped = aiService.scrapeJobPosting(url);

        String descriptionWithUrl = scraped.description()
                + "\n\n---\n📌 출처 URL: " + url;

        // 스크래핑으로 추출한 마감일을 LocalDate로 변환합니다
        LocalDate dueDate = null;
        if (scraped.due_date() != null && !scraped.due_date().isBlank()) {
            try {
                dueDate = LocalDate.parse(scraped.due_date());
            } catch (Exception ignored) {
                // 파싱 실패 시 마감일 없이 저장
            }
        }

        JobPostingEntity jobPosting = JobPostingEntity.builder()
                .user(user)
                .company(scraped.company())
                .position(scraped.position())
                .description(descriptionWithUrl)
                .location(scraped.location())
                .sourceUrl(url)
                .dueDate(dueDate)
                .build();

        return JobPostingResponseDto.from(jobPostingRepository.save(jobPosting));
    }

    /** 채용공고 삭제 (소유자만) */
    @Transactional
    public void deleteJobPosting(Long id, String email) {
        JobPostingEntity jobPosting = getWithOwnerCheck(id, email);
        s3StorageService.deleteFile(jobPosting.getFileUrl());
        jobPostingRepository.delete(jobPosting);
    }

    private JobPostingEntity getWithOwnerCheck(Long id, String email) {
        JobPostingEntity jobPosting = jobPostingRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
        if (!jobPosting.getUser().getEmail().equals(email)) {
            throw new BusinessException(ErrorCode.FORBIDDEN);
        }
        return jobPosting;
    }

    private UserEntity getUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));
    }
}
