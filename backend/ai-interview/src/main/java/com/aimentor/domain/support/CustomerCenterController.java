package com.aimentor.domain.support;

import com.aimentor.common.ApiResponse;
import com.aimentor.domain.support.dto.CustomerCenterInquiryCreateRequestDto;
import com.aimentor.domain.support.dto.CustomerCenterInquiryResponseDto;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 고객센터 사용자 API 컨트롤러입니다.
 *
 * [역할]
 * 로그인한 사용자가 내 문의를 등록하고 조회하는 진입점입니다.
 */
@RestController
@RequestMapping("/api/support")
@RequiredArgsConstructor
public class CustomerCenterController {

    private final CustomerCenterInquiryService customerCenterInquiryService;

    /**
     * 내 문의 목록을 최신 순으로 조회합니다.
     */
    @GetMapping("/inquiries")
    public ResponseEntity<ApiResponse<List<CustomerCenterInquiryResponseDto>>> getMyInquiries(
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                customerCenterInquiryService.getMyInquiries(userDetails.getUsername())
        ));
    }

    /**
     * 새 문의를 등록합니다.
     */
    @PostMapping("/inquiries")
    public ResponseEntity<ApiResponse<CustomerCenterInquiryResponseDto>> createInquiry(
            @Valid @RequestBody CustomerCenterInquiryCreateRequestDto request,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        CustomerCenterInquiryResponseDto response = customerCenterInquiryService.createInquiry(
                userDetails.getUsername(),
                request
        );

        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(response));
    }

    /**
     * 내 문의를 삭제합니다.
     */
    @DeleteMapping("/inquiries/{inquiryId}")
    public ResponseEntity<ApiResponse<Void>> deleteMyInquiry(
            @PathVariable Long inquiryId,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        customerCenterInquiryService.deleteMyInquiry(userDetails.getUsername(), inquiryId);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    /**
     * 공개 문의 페이징 조회 (비로그인도 조회 가능)
     */
    @GetMapping("/inquiries/public")
    public ResponseEntity<ApiResponse<Page<CustomerCenterInquiryResponseDto>>> getPublicInquiries(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "5") int size
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                customerCenterInquiryService.getPublicInquiries(page, size)
        ));
    }

    /**
     * 도움됨 카운트 증가
     */
    @PostMapping("/inquiries/{inquiryId}/helpful")
    public ResponseEntity<ApiResponse<CustomerCenterInquiryResponseDto>> incrementHelpful(
            @PathVariable Long inquiryId
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                customerCenterInquiryService.incrementHelpful(inquiryId)
        ));
    }
}
