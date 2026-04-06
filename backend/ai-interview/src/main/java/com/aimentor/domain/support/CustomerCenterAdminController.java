package com.aimentor.domain.support;

import com.aimentor.common.ApiResponse;
import com.aimentor.domain.support.dto.CustomerCenterInquiryReplyRequestDto;
import com.aimentor.domain.support.dto.CustomerCenterInquiryResponseDto;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 고객센터 관리자 API 컨트롤러입니다.
 *
 * [역할]
 * 관리자 화면에서 전체 문의를 읽고 답변을 저장할 때 사용합니다.
 *
 * [보안]
 * 실제 접근 권한은 SecurityConfig의 `/api/admin/**` 규칙으로 ADMIN만 허용됩니다.
 */
@RestController
@RequestMapping("/api/admin/inquiries")
@RequiredArgsConstructor
public class CustomerCenterAdminController {

    private final CustomerCenterInquiryService customerCenterInquiryService;

    /**
     * 전체 문의 목록을 최신 순으로 조회합니다.
     */
    @GetMapping
    public ResponseEntity<ApiResponse<List<CustomerCenterInquiryResponseDto>>> getInquiries() {
        return ResponseEntity.ok(ApiResponse.success(
                customerCenterInquiryService.getAllInquiries()
        ));
    }

    /**
     * 특정 문의에 관리자 답변을 저장합니다.
     */
    @PatchMapping("/{id}/reply")
    public ResponseEntity<ApiResponse<CustomerCenterInquiryResponseDto>> replyInquiry(
            @PathVariable Long id,
            @Valid @RequestBody CustomerCenterInquiryReplyRequestDto request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                customerCenterInquiryService.replyInquiry(id, request)
        ));
    }

    /**
     * 공개 문의를 비밀글로 전환합니다.
     */
    @PatchMapping("/{id}/make-private")
    public ResponseEntity<ApiResponse<CustomerCenterInquiryResponseDto>> makeInquiryPrivate(
            @PathVariable Long id
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                customerCenterInquiryService.makeInquiryPrivate(id)
        ));
    }
}
