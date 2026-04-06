package com.aimentor.domain.subscription;

import com.aimentor.common.BusinessException;
import com.aimentor.common.ErrorCode;
import com.aimentor.common.payment.PaymentResultRequestDto;
import com.aimentor.common.payment.PaymentResultType;
import com.aimentor.domain.subscription.dto.SubscriptionCreateRequestDto;
import com.aimentor.domain.subscription.dto.SubscriptionResponseDto;
import com.aimentor.domain.user.UserEntity;
import com.aimentor.domain.user.UserRepository;
import com.aimentor.external.payment.PortOneService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 구독 서비스입니다.
 *
 * [핵심 흐름]
 * 1. 결제 준비 단계에서는 PENDING 구독을 생성합니다.
 * 2. 결제 승인 시 ACTIVE로 전환하고 기존 활성 구독을 만료 처리합니다.
 * 3. 결제 실패/취소는 별도 상태로 남겨 결과 화면과 이력에서 구분합니다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class SubscriptionService {

    private final SubscriptionRepository subscriptionRepository;
    private final UserRepository userRepository;
    private final PortOneService portOneService;

    /**
     * 현재 사용자에게 보여 줄 대표 구독을 반환합니다.
     *
     * [규칙]
     * 활성 구독이 있으면 그것을 우선 보여 주고,
     * 활성 구독이 없으면 가장 최근 결제 시도를 반환합니다.
     * 이렇게 해야 실패한 최신 시도가 있어도 현재 활성 구독을 놓치지 않습니다.
     */
    @Transactional
    public SubscriptionResponseDto getMyLatestSubscription(String email) {
        UserEntity user = findUser(email);
        LocalDateTime now = LocalDateTime.now();

        List<SubscriptionEntity> subscriptions = subscriptionRepository.findAllByUserIdOrderBySubscribedAtDesc(user.getId());
        refreshExpiredSubscriptions(user.getId(), now);

        return subscriptions.stream()
                .filter(subscription -> subscription.isCurrentlyActive(now))
                .findFirst()
                .map(subscription -> SubscriptionResponseDto.from(subscription, true))
                .orElseGet(() -> subscriptions.stream()
                        .findFirst()
                        .map(subscription -> SubscriptionResponseDto.from(subscription, subscription.isCurrentlyActive(now)))
                        .orElse(null));
    }

    /**
     * 내 구독 상세를 조회합니다.
     */
    @Transactional
    public SubscriptionResponseDto getSubscriptionDetail(String email, Long subscriptionId) {
        UserEntity user = findUser(email);
        LocalDateTime now = LocalDateTime.now();
        refreshExpiredSubscriptions(user.getId(), now);

        SubscriptionEntity subscription = subscriptionRepository.findByIdAndUserId(subscriptionId, user.getId())
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));

        return SubscriptionResponseDto.from(subscription, subscription.isCurrentlyActive(now));
    }

    /**
     * 내 구독 이력을 조회합니다.
     */
    @Transactional
    public List<SubscriptionResponseDto> getMySubscriptions(String email) {
        UserEntity user = findUser(email);
        LocalDateTime now = LocalDateTime.now();
        refreshExpiredSubscriptions(user.getId(), now);

        return subscriptionRepository.findAllByUserIdOrderBySubscribedAtDesc(user.getId()).stream()
                .map(subscription -> SubscriptionResponseDto.from(subscription, subscription.isCurrentlyActive(now)))
                .toList();
    }

    /**
     * 결제 준비 단계의 구독을 생성합니다.
     *
     * [주의]
     * 아직 승인되지 않았으므로 기존 활성 구독은 건드리지 않습니다.
     * 승인 콜백이 들어왔을 때만 실제 이용 상태를 바꿉니다.
     */
    @Transactional
    public SubscriptionResponseDto createSubscription(String email, SubscriptionCreateRequestDto request) {
        UserEntity user = findUser(email);
        SubscriptionPlan plan = SubscriptionPlan.fromKey(request.planKey());
        LocalDateTime now = LocalDateTime.now();

        SubscriptionEntity subscription = SubscriptionEntity.builder()
                .user(user)
                .planKey(plan.getKey())
                .planName(plan.getDisplayName())
                .durationDays(plan.getDurationDays())
                .paymentAmount(plan.getPaymentAmount())
                .paymentMethod(request.paymentMethod())
                .status(SubscriptionStatus.PENDING)
                .startedAt(now)
                .expiresAt(now.plusDays(plan.getDurationDays()))
                .subscribedAt(now)
                .build();

        SubscriptionEntity saved = subscriptionRepository.save(subscription);
        log.info("구독 결제 대기 생성: subscriptionId={}, userId={}, planKey={}",
                saved.getId(), user.getId(), saved.getPlanKey());
        return SubscriptionResponseDto.from(saved, false);
    }

    /**
     * PortOne 결제 검증 후 구독을 ACTIVE로 확정합니다.
     *
     * [흐름]
     * 1. 구독 소유권 · 상태(PENDING) 확인
     * 2. PortOne V2 API로 paymentId 조회 → 상태(PAID) + 금액 비교
     * 3. 검증 통과 시 기존 활성 구독 만료 → ACTIVE 전환
     * 4. 금액 불일치 / 상태 불일치 시 BusinessException → PAYMENT_FAILED 처리
     *
     * [위변조 방지]
     * 프론트에서 보내는 paymentId는 "sub_{subscriptionId}_{ts}" 형식입니다.
     * 백엔드는 PortOne에 직접 조회해 결제 금액이 DB 구독 금액과 일치하는지 확인합니다.
     */
    @Transactional
    public SubscriptionResponseDto verifyAndConfirmPayment(String email, Long subscriptionId, String paymentId) {
        UserEntity user = findUser(email);
        SubscriptionEntity subscription = subscriptionRepository.findByIdAndUserId(subscriptionId, user.getId())
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));

        // 이미 활성화된 구독이면 그대로 반환 (멱등성 — Webhook 중복 호출 대비)
        if (subscription.getStatus() == SubscriptionStatus.ACTIVE) {
            log.info("이미 활성화된 구독: subscriptionId={}", subscriptionId);
            LocalDateTime now = LocalDateTime.now();
            return SubscriptionResponseDto.from(subscription, subscription.isCurrentlyActive(now));
        }

        if (subscription.getStatus() != SubscriptionStatus.PENDING) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                    "결제 대기 상태의 구독만 검증할 수 있습니다.");
        }

        LocalDateTime now = LocalDateTime.now();

        try {
            // PortOne V2 결제 검증 (금액 위변조 포함)
            portOneService.verifyPayment(paymentId, subscription.getPaymentAmount());
            expireActiveSubscriptions(user.getId());
            subscription.markActive(now);
            log.info("PortOne 결제 검증 완료 → ACTIVE: subscriptionId={}, paymentId={}", subscriptionId, paymentId);
        } catch (BusinessException e) {
            subscription.markPaymentFailed();
            log.warn("PortOne 결제 검증 실패 → PAYMENT_FAILED: subscriptionId={}, reason={}", subscriptionId, e.getMessage());
            throw e;
        }

        return SubscriptionResponseDto.from(subscription, subscription.isCurrentlyActive(now));
    }

    /**
     * 결제 결과를 구독에 반영합니다.
     */
    @Transactional
    public SubscriptionResponseDto applyPaymentResult(String email, Long subscriptionId, PaymentResultRequestDto request) {
        UserEntity user = findUser(email);
        SubscriptionEntity subscription = subscriptionRepository.findByIdAndUserId(subscriptionId, user.getId())
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));

        if (subscription.getStatus() != SubscriptionStatus.PENDING) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "결제 대기 상태의 구독만 결제 결과를 반영할 수 있습니다.");
        }

        LocalDateTime now = LocalDateTime.now();

        if (request.resultType() == PaymentResultType.APPROVED) {
            expireActiveSubscriptions(user.getId());
            subscription.markActive(now);
        } else if (request.resultType() == PaymentResultType.CANCELLED) {
            subscription.markCancelled();
        } else {
            subscription.markPaymentFailed();
        }

        return SubscriptionResponseDto.from(subscription, subscription.isCurrentlyActive(now));
    }

    /**
     * 이미 만료 시각이 지난 활성 구독을 정리합니다.
     *
     * [이유]
     * 오래된 ACTIVE 상태가 남아 있으면 현재 구독 화면이 잘못 보일 수 있어서
     * 조회 시점마다 한 번 더 정리합니다.
     */
    private void refreshExpiredSubscriptions(Long userId, LocalDateTime now) {
        List<SubscriptionEntity> activeSubscriptions =
                subscriptionRepository.findAllByUserIdAndStatus(userId, SubscriptionStatus.ACTIVE);

        for (SubscriptionEntity activeSubscription : activeSubscriptions) {
            if (!activeSubscription.getExpiresAt().isAfter(now)) {
                activeSubscription.markExpired();
            }
        }
    }

    /**
     * 새 구독 승인 전에 기존 활성 구독을 모두 만료 처리합니다.
     */
    private void expireActiveSubscriptions(Long userId) {
        List<SubscriptionEntity> activeSubscriptions =
                subscriptionRepository.findAllByUserIdAndStatus(userId, SubscriptionStatus.ACTIVE);

        for (SubscriptionEntity activeSubscription : activeSubscriptions) {
            activeSubscription.markExpired();
        }
    }

    /**
     * 로그인 사용자 엔티티를 조회합니다.
     */
    private UserEntity findUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));
    }
}
