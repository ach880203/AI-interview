package com.aimentor.domain.support;

import com.aimentor.common.ApiResponse;
import com.aimentor.domain.support.dto.CustomerCenterFaqResponseDto;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 고객센터 FAQ 사용자 API입니다.
 *
 * [역할]
 * 고객센터 페이지에서 자주 묻는 질문 목록을 읽을 때 사용합니다.
 */
@RestController
@RequestMapping("/api/support/faqs")
@RequiredArgsConstructor
public class CustomerCenterFaqController {

    private final CustomerCenterFaqService customerCenterFaqService;

    /**
     * FAQ 목록을 조회합니다.
     */
    @GetMapping
    public ResponseEntity<ApiResponse<List<CustomerCenterFaqResponseDto>>> getFaqs() {
        return ResponseEntity.ok(ApiResponse.success(customerCenterFaqService.getFaqs()));
    }
}
