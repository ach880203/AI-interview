package com.aimentor.domain.profile.coverletter;

import com.aimentor.common.ApiResponse;
import com.aimentor.domain.profile.coverletter.dto.CoverLetterCreateRequestDto;
import com.aimentor.domain.profile.coverletter.dto.CoverLetterResponseDto;
import com.aimentor.domain.profile.coverletter.dto.CoverLetterUpdateRequestDto;
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
 * 자기소개서 API 컨트롤러
 * 기본 경로: /api/cover-letters
 * 모든 엔드포인트 🔒 인증 필요
 * multipart/form-data 요청 — request(JSON) + file(선택) 파트로 구성
 */
@RestController
@RequestMapping("/api/cover-letters")
@RequiredArgsConstructor
public class CoverLetterController {

    private final CoverLetterService coverLetterService;

    /** GET /api/cover-letters - 내 자기소개서 목록 */
    @GetMapping
    public ResponseEntity<ApiResponse<List<CoverLetterResponseDto>>> getMyCoverLetters(
            @AuthenticationPrincipal UserDetails userDetails) {

        return ResponseEntity.ok(ApiResponse.success(
                coverLetterService.getMyCoverLetters(userDetails.getUsername())));
    }

    /** GET /api/cover-letters/{id} - 자기소개서 상세 */
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<CoverLetterResponseDto>> getCoverLetter(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails userDetails) {

        return ResponseEntity.ok(ApiResponse.success(
                coverLetterService.getCoverLetter(id, userDetails.getUsername())));
    }

    /** POST /api/cover-letters - 자기소개서 등록 (multipart) */
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<CoverLetterResponseDto>> createCoverLetter(
            @RequestPart("request") @Valid CoverLetterCreateRequestDto request,
            @RequestPart(value = "file", required = false) MultipartFile file,
            @AuthenticationPrincipal UserDetails userDetails) {

        CoverLetterResponseDto response = coverLetterService.createCoverLetter(
                request, file, userDetails.getUsername());
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(response));
    }

    /** PUT /api/cover-letters/{id} - 자기소개서 수정 (multipart) */
    @PutMapping(value = "/{id}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<CoverLetterResponseDto>> updateCoverLetter(
            @PathVariable Long id,
            @RequestPart("request") @Valid CoverLetterUpdateRequestDto request,
            @RequestPart(value = "file", required = false) MultipartFile file,
            @AuthenticationPrincipal UserDetails userDetails) {

        return ResponseEntity.ok(ApiResponse.success(
                coverLetterService.updateCoverLetter(id, request, file, userDetails.getUsername())));
    }

    /** DELETE /api/cover-letters/{id} - 자기소개서 삭제 */
    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteCoverLetter(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails userDetails) {

        coverLetterService.deleteCoverLetter(id, userDetails.getUsername());
        return ResponseEntity.ok(ApiResponse.success());
    }
}
