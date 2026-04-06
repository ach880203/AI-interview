package com.aimentor.domain.support;

import com.aimentor.common.BusinessException;
import com.aimentor.common.ErrorCode;
import com.aimentor.domain.support.dto.CustomerCenterFaqCreateRequestDto;
import com.aimentor.domain.support.dto.CustomerCenterFaqResponseDto;
import com.aimentor.domain.support.dto.CustomerCenterFaqUpdateRequestDto;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * 고객센터 FAQ 서비스입니다.
 *
 * [역할]
 * FAQ 조회, 등록, 수정, 삭제를 한 곳에서 담당합니다.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CustomerCenterFaqService {

    private final CustomerCenterFaqRepository customerCenterFaqRepository;

    /**
     * FAQ 목록을 생성 순서대로 조회합니다.
     * 오래된 기본 안내부터 차례대로 보여 주는 편이 고객센터 화면에서 읽기 쉽습니다.
     */
    public List<CustomerCenterFaqResponseDto> getFaqs() {
        return customerCenterFaqRepository.findAllByOrderByCreatedAtAsc()
                .stream()
                .map(CustomerCenterFaqResponseDto::from)
                .toList();
    }

    /**
     * 새 FAQ를 등록합니다.
     */
    @Transactional
    public CustomerCenterFaqResponseDto createFaq(CustomerCenterFaqCreateRequestDto request) {
        CustomerCenterFaqEntity faq = CustomerCenterFaqEntity.builder()
                .category(request.category().trim())
                .question(request.question().trim())
                .answer(request.answer().trim())
                .build();

        return CustomerCenterFaqResponseDto.from(customerCenterFaqRepository.save(faq));
    }

    /**
     * 기존 FAQ를 수정합니다.
     */
    @Transactional
    public CustomerCenterFaqResponseDto updateFaq(Long faqId, CustomerCenterFaqUpdateRequestDto request) {
        CustomerCenterFaqEntity faq = customerCenterFaqRepository.findById(faqId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));

        faq.update(
                request.category().trim(),
                request.question().trim(),
                request.answer().trim()
        );

        return CustomerCenterFaqResponseDto.from(faq);
    }

    /**
     * FAQ를 삭제합니다.
     */
    @Transactional
    public void deleteFaq(Long faqId) {
        CustomerCenterFaqEntity faq = customerCenterFaqRepository.findById(faqId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));

        customerCenterFaqRepository.delete(faq);
    }
}
