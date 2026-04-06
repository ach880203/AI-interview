package com.aimentor.domain.support;

import com.aimentor.common.ApiResponse;
import com.aimentor.domain.support.dto.CustomerCenterFaqCreateRequestDto;
import com.aimentor.domain.support.dto.CustomerCenterFaqResponseDto;
import com.aimentor.domain.support.dto.CustomerCenterFaqUpdateRequestDto;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 고객센터 FAQ 관리자 API입니다.
 *
 * [역할]
 * 관리자 화면에서 FAQ를 등록, 수정, 삭제할 때 사용합니다.
 */
@RestController
@RequestMapping("/api/admin/faqs")
@RequiredArgsConstructor
public class CustomerCenterFaqAdminController {

    private final CustomerCenterFaqService customerCenterFaqService;

    /**
     * 전체 FAQ 목록을 조회합니다.
     */
    @GetMapping
    public ResponseEntity<ApiResponse<List<CustomerCenterFaqResponseDto>>> getFaqs() {
        return ResponseEntity.ok(ApiResponse.success(customerCenterFaqService.getFaqs()));
    }

    /**
     * 새 FAQ를 등록합니다.
     */
    @PostMapping
    public ResponseEntity<ApiResponse<CustomerCenterFaqResponseDto>> createFaq(
            @Valid @RequestBody CustomerCenterFaqCreateRequestDto request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(customerCenterFaqService.createFaq(request)));
    }

    /**
     * FAQ를 수정합니다.
     */
    @PatchMapping("/{id}")
    public ResponseEntity<ApiResponse<CustomerCenterFaqResponseDto>> updateFaq(
            @PathVariable Long id,
            @Valid @RequestBody CustomerCenterFaqUpdateRequestDto request
    ) {
        return ResponseEntity.ok(ApiResponse.success(customerCenterFaqService.updateFaq(id, request)));
    }

    /**
     * FAQ를 삭제합니다.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteFaq(@PathVariable Long id) {
        customerCenterFaqService.deleteFaq(id);
        return ResponseEntity.ok(ApiResponse.success());
    }
}
