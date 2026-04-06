package com.aimentor.domain.support;

import com.aimentor.common.BusinessException;
import com.aimentor.common.ErrorCode;
import com.aimentor.domain.support.dto.CustomerCenterInquiryCreateRequestDto;
import com.aimentor.domain.support.dto.CustomerCenterInquiryReplyRequestDto;
import com.aimentor.domain.support.dto.CustomerCenterInquiryResponseDto;
import com.aimentor.domain.user.UserEntity;
import com.aimentor.domain.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * 고객센터 문의 서비스입니다.
 *
 * [역할]
 * 사용자 문의 등록/조회와 관리자 답변 저장을 담당합니다.
 *
 * [구조 이유]
 * 고객센터 화면과 관리자 문의 관리 화면이 같은 문의 데이터를 바라보게 해야 하므로
 * 브라우저 저장소 대신 하나의 서비스 계층으로 읽기/쓰기를 모읍니다.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CustomerCenterInquiryService {

    private final CustomerCenterInquiryRepository customerCenterInquiryRepository;
    private final CustomerCenterFaqRepository customerCenterFaqRepository;
    private final UserRepository userRepository;

    /**
     * 로그인한 사용자의 문의를 등록합니다.
     */
    @Transactional
    public CustomerCenterInquiryResponseDto createInquiry(
            String email,
            CustomerCenterInquiryCreateRequestDto request
    ) {
        UserEntity user = findUserByEmail(email);

        CustomerCenterInquiryEntity inquiry = CustomerCenterInquiryEntity.builder()
                .user(user)
                .title(request.title().trim())
                .content(request.content().trim())
                .isPublic(Boolean.TRUE.equals(request.isPublic()))
                .build();

        CustomerCenterInquiryEntity savedInquiry = customerCenterInquiryRepository.save(inquiry);
        return CustomerCenterInquiryResponseDto.from(savedInquiry);
    }

    /**
     * 로그인한 사용자의 내 문의 목록을 최신 순으로 조회합니다.
     */
    public List<CustomerCenterInquiryResponseDto> getMyInquiries(String email) {
        UserEntity user = findUserByEmail(email);

        return customerCenterInquiryRepository.findAllByUserIdOrderByCreatedAtDesc(user.getId())
                .stream()
                .map(CustomerCenterInquiryResponseDto::from)
                .toList();
    }

    /**
     * 로그인한 사용자가 자신의 문의를 삭제합니다.
     *
     * [권한 규칙]
     * 문의 작성자 본인만 삭제할 수 있습니다.
     * 다른 사용자의 문의를 지우려는 경우에는 권한 오류를 반환합니다.
     */
    @Transactional
    public void deleteMyInquiry(String email, Long inquiryId) {
        UserEntity user = findUserByEmail(email);
        CustomerCenterInquiryEntity inquiry = findInquiryById(inquiryId);

        if (!inquiry.getUser().getId().equals(user.getId())) {
            throw new BusinessException(ErrorCode.FORBIDDEN);
        }

        customerCenterInquiryRepository.delete(inquiry);
    }

    /**
     * 관리자 화면에서 전체 문의 목록을 조회합니다.
     */
    public List<CustomerCenterInquiryResponseDto> getAllInquiries() {
        return customerCenterInquiryRepository.findAllByOrderByCreatedAtDesc()
                .stream()
                .map(CustomerCenterInquiryResponseDto::from)
                .toList();
    }

    /**
     * 관리자 답변을 저장합니다.
     *
     * [주의]
     * 비어 있는 답변은 허용하지 않습니다.
     * 프런트에서 draft 상태를 따로 들고 있다가 저장 시점에만 API를 호출하도록 설계했습니다.
     */
    @Transactional
    public CustomerCenterInquiryResponseDto replyInquiry(
            Long inquiryId,
            CustomerCenterInquiryReplyRequestDto request
    ) {
        CustomerCenterInquiryEntity inquiry = findInquiryById(inquiryId);

        inquiry.saveReply(request.reply().trim());
        return CustomerCenterInquiryResponseDto.from(inquiry);
    }

    /**
     * 관리자가 공개 문의를 비밀글로 전환합니다.
     *
     * [운영 규칙]
     * 공개글을 비밀글로 내리는 것만 허용합니다.
     * 다시 공개로 되돌리는 기능은 제공하지 않아, 일반 사용자가 노출 상태를 복구할 수 없게 유지합니다.
     */
    @Transactional
    public CustomerCenterInquiryResponseDto makeInquiryPrivate(Long inquiryId) {
        CustomerCenterInquiryEntity inquiry = findInquiryById(inquiryId);

        if (inquiry.isPublic()) {
            inquiry.makePrivate();
        }

        return CustomerCenterInquiryResponseDto.from(inquiry);
    }

    /**
     * 공개 문의 페이징 조회 (모든 상태의 공개글 포함)
     *
     * [버그 수정]
     * 수정 전: findAllByIsPublicTrueAndStatus(ANSWERED) → 새 공개 문의(WAITING)가 안 보이는 버그
     * 수정 후: findAllByIsPublicTrue() → 모든 상태의 공개 문의를 표시
     *
     * [정렬 규칙]
     * 도움됨 수 내림차순 → 최신 등록순
     */
    public Page<CustomerCenterInquiryResponseDto> getPublicInquiries(int page, int size) {
        PageRequest pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "helpfulCount", "createdAt"));
        return customerCenterInquiryRepository
                .findAllByIsPublicTrue(pageable)
                .map(CustomerCenterInquiryResponseDto::from);
    }

    /**
     * 도움됨 카운트를 증가시킵니다.
     * 20개 이상이면 FAQ 자동 승격 대상임을 반환합니다.
     */
    @Transactional
    public CustomerCenterInquiryResponseDto incrementHelpful(Long inquiryId) {
        CustomerCenterInquiryEntity inquiry = customerCenterInquiryRepository.findById(inquiryId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));

        inquiry.incrementHelpful();

        // 도움됨 20개 이상이면 FAQ로 자동 승격
        if (inquiry.getHelpfulCount() >= 20) {
            autoPromoteToFaq(inquiry);
        }

        return CustomerCenterInquiryResponseDto.from(inquiry);
    }

    /**
     * 도움됨이 충분히 쌓인 문의를 FAQ로 자동 승격합니다.
     */
    private void autoPromoteToFaq(CustomerCenterInquiryEntity inquiry) {
        // FAQ에 같은 제목이 이미 있으면 중복 생성하지 않음
        if (customerCenterFaqRepository.existsByQuestion(inquiry.getTitle())) {
            return;
        }

        CustomerCenterFaqEntity faq = CustomerCenterFaqEntity.builder()
                .category("자주 묻는 질문")
                .question(inquiry.getTitle())
                .answer(inquiry.getReply() != null ? inquiry.getReply() : inquiry.getContent())
                .build();

        customerCenterFaqRepository.save(faq);
    }

    private UserEntity findUserByEmail(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));
    }

    private CustomerCenterInquiryEntity findInquiryById(Long inquiryId) {
        return customerCenterInquiryRepository.findById(inquiryId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
    }
}
