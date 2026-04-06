package com.aimentor.domain.profile.jobposting;

import com.aimentor.common.ApiResponse;
import com.aimentor.domain.profile.jobposting.dto.JobPostingCreateRequestDto;
import com.aimentor.domain.profile.jobposting.dto.JobPostingResponseDto;
import com.aimentor.domain.profile.jobposting.dto.JobPostingUpdateRequestDto;
import com.aimentor.domain.profile.jobposting.dto.JobPostingUrlRequestDto;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

/**
 * 채용공고 API 컨트롤러
 * 기본 경로: /api/job-postings
 * 모든 엔드포인트 🔒 인증 필요
 *
 * 파일 업로드 엔드포인트: multipart/form-data
 *   - "request" 파트 (application/json): 채용공고 데이터
 *   - "file" 파트 (optional): 공고 PDF 등 첨부 파일
 */
@RestController
@RequestMapping("/api/job-postings")
@RequiredArgsConstructor
public class JobPostingController {

    private final JobPostingService jobPostingService;

    /** GET /api/job-postings - 내 채용공고 목록 */
    @GetMapping
    public ResponseEntity<ApiResponse<List<JobPostingResponseDto>>> getMyJobPostings(
            @AuthenticationPrincipal UserDetails userDetails) {

        return ResponseEntity.ok(ApiResponse.success(
                jobPostingService.getMyJobPostings(userDetails.getUsername())));
    }

    /** GET /api/job-postings/{id} - 채용공고 상세 */
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<JobPostingResponseDto>> getJobPosting(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails userDetails) {

        return ResponseEntity.ok(ApiResponse.success(
                jobPostingService.getJobPosting(id, userDetails.getUsername())));
    }

    /**
     * POST /api/job-postings - 채용공고 등록
     * Content-Type: multipart/form-data
     */
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<JobPostingResponseDto>> createJobPosting(
            @RequestPart("request") @Valid JobPostingCreateRequestDto request,
            @RequestPart(value = "file", required = false) MultipartFile file,
            @AuthenticationPrincipal UserDetails userDetails) {

        JobPostingResponseDto response = jobPostingService.createJobPosting(
                request, file, userDetails.getUsername());
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(response));
    }

    /**
     * PUT /api/job-postings/{id} - 채용공고 수정
     * Content-Type: multipart/form-data
     */
    @PutMapping(value = "/{id}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<JobPostingResponseDto>> updateJobPosting(
            @PathVariable Long id,
            @RequestPart("request") @Valid JobPostingUpdateRequestDto request,
            @RequestPart(value = "file", required = false) MultipartFile file,
            @AuthenticationPrincipal UserDetails userDetails) {

        return ResponseEntity.ok(ApiResponse.success(
                jobPostingService.updateJobPosting(id, request, file, userDetails.getUsername())));
    }

    /**
     * POST /api/job-postings/from-url - URL로 채용공고 자동 등록
     * AI가 URL을 스크래핑해 company/position/description을 자동 추출합니다.
     * Content-Type: application/json
     */
    @PostMapping("/from-url")
    public ResponseEntity<ApiResponse<JobPostingResponseDto>> createFromUrl(
            @Valid @RequestBody JobPostingUrlRequestDto request,
            @AuthenticationPrincipal UserDetails userDetails) {

        JobPostingResponseDto response = jobPostingService.createFromUrl(
                request.url(), userDetails.getUsername());
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(response));
    }

    /** DELETE /api/job-postings/{id} - 채용공고 삭제 */
    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteJobPosting(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails userDetails) {

        jobPostingService.deleteJobPosting(id, userDetails.getUsername());
        return ResponseEntity.ok(ApiResponse.success());
    }
}
