package com.aimentor.domain.profile.resume;

import com.aimentor.common.ApiResponse;
import com.aimentor.domain.profile.resume.dto.ResumeCreateRequestDto;
import com.aimentor.domain.profile.resume.dto.ResumeResponseDto;
import com.aimentor.domain.profile.resume.dto.ResumeUpdateRequestDto;
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
 * 이력서 API 컨트롤러
 * 기본 경로: /api/resumes
 * 모든 엔드포인트 🔒 인증 필요 (SecurityConfig에서 anyRequest().authenticated())
 *
 * 파일 업로드가 있는 엔드포인트: multipart/form-data
 *   - "request" 파트: JSON (ResumeCreateRequestDto / ResumeUpdateRequestDto)
 *   - "file" 파트: 첨부 파일 (optional)
 */
@RestController
@RequestMapping("/api/resumes")
@RequiredArgsConstructor
public class ResumeController {

    private final ResumeService resumeService;

    /** GET /api/resumes - 내 이력서 목록 */
    @GetMapping
    public ResponseEntity<ApiResponse<List<ResumeResponseDto>>> getMyResumes(
            @AuthenticationPrincipal UserDetails userDetails) {

        return ResponseEntity.ok(ApiResponse.success(
                resumeService.getMyResumes(userDetails.getUsername())));
    }

    /** GET /api/resumes/{id} - 이력서 상세 조회 */
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<ResumeResponseDto>> getResume(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails userDetails) {

        return ResponseEntity.ok(ApiResponse.success(
                resumeService.getResume(id, userDetails.getUsername())));
    }

    /**
     * POST /api/resumes - 이력서 등록
     * Content-Type: multipart/form-data
     * - "request" 파트 (application/json): { "title": "...", "content": "..." }
     * - "file" 파트 (optional): 이력서 파일
     */
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<ResumeResponseDto>> createResume(
            @RequestPart("request") @Valid ResumeCreateRequestDto request,
            @RequestPart(value = "file", required = false) MultipartFile file,
            @AuthenticationPrincipal UserDetails userDetails) {

        ResumeResponseDto response = resumeService.createResume(request, file, userDetails.getUsername());
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(response));
    }

    /**
     * PUT /api/resumes/{id} - 이력서 수정
     * Content-Type: multipart/form-data
     * - "request" 파트 (application/json): { "title": "...", "content": "..." }
     * - "file" 파트 (optional): 새 파일 (없으면 기존 파일 유지)
     */
    @PutMapping(value = "/{id}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<ResumeResponseDto>> updateResume(
            @PathVariable Long id,
            @RequestPart("request") @Valid ResumeUpdateRequestDto request,
            @RequestPart(value = "file", required = false) MultipartFile file,
            @AuthenticationPrincipal UserDetails userDetails) {

        ResumeResponseDto response = resumeService.updateResume(id, request, file, userDetails.getUsername());
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    /** DELETE /api/resumes/{id} - 이력서 삭제 */
    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteResume(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails userDetails) {

        resumeService.deleteResume(id, userDetails.getUsername());
        return ResponseEntity.ok(ApiResponse.success());
    }
}
