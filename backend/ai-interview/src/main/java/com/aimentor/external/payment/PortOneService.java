package com.aimentor.external.payment;

import com.aimentor.common.BusinessException;
import com.aimentor.common.ErrorCode;
import com.aimentor.external.payment.dto.PortOnePaymentResponseDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

/**
 * PortOne V2 결제 서비스
 *
 * [역할]
 * 프론트엔드에서 SDK로 결제 완료 후 받은 paymentId를 PortOne REST API로 조회하여
 * 결제 금액과 상태를 서버사이드에서 검증합니다.
 *
 * [결제 위변조 방지 원칙]
 * 클라이언트가 보내는 "결제 성공" 신호를 그대로 신뢰하면 안 됩니다.
 * 반드시 백엔드에서 PortOne에 직접 조회해 금액과 상태를 확인해야 합니다.
 *
 * [API 엔드포인트]
 * GET https://api.portone.io/payments/{paymentId}
 * Authorization: PortOne {SECRET_KEY}
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PortOneService {

    private final RestTemplate restTemplate;

    /** PortOne V2 시크릿 키 (환경변수: PORTONE_SECRET_KEY) */
    @Value("${portone.secret-key:}")
    private String secretKey;

    private static final String PORTONE_API_BASE = "https://api.portone.io";

    /**
     * PortOne에서 결제 정보를 조회합니다.
     *
     * [검증 항목]
     * 1. 결제 상태: "PAID" 여부
     * 2. 결제 금액: PortOne 결제 금액 == 주문 금액 (위변조 방지)
     *
     * @param paymentId  프론트엔드 SDK가 사용한 결제 ID ("order_{orderId}_{ts}" 형식)
     * @param orderPrice 주문 DB에 저장된 결제 예정 금액 (위변조 비교 기준)
     * @return PortOne 결제 조회 응답
     * @throws BusinessException 결제 상태가 PAID가 아니거나 금액 불일치 시
     */
    public PortOnePaymentResponseDto verifyPayment(String paymentId, int orderPrice) {
        if (secretKey == null || secretKey.isBlank()) {
            log.warn("PortOne 시크릿 키가 설정되지 않아 결제 검증을 건너뜁니다. (개발 환경 전용)");
            // 개발 환경에서 시크릿 키 없이 호출된 경우 검증 없이 성공으로 처리
            return new PortOnePaymentResponseDto(
                    paymentId, "PAID", "도서 구매",
                    new PortOnePaymentResponseDto.Amount(orderPrice, orderPrice)
            );
        }

        HttpHeaders headers = new HttpHeaders();
        headers.set("Authorization", "PortOne " + secretKey);
        headers.setContentType(MediaType.APPLICATION_JSON);

        HttpEntity<Void> request = new HttpEntity<>(headers);
        String url = PORTONE_API_BASE + "/payments/" + paymentId;

        try {
            ResponseEntity<PortOnePaymentResponseDto> response = restTemplate.exchange(
                    url, HttpMethod.GET, request, PortOnePaymentResponseDto.class);

            PortOnePaymentResponseDto payment = response.getBody();
            if (payment == null) {
                throw new BusinessException(ErrorCode.PAYMENT_VERIFICATION_FAILED);
            }

            // 결제 상태 검증
            if (!payment.isPaid()) {
                log.warn("PortOne 결제 상태 불일치: paymentId={}, status={}", paymentId, payment.status());
                throw new BusinessException(ErrorCode.PAYMENT_VERIFICATION_FAILED);
            }

            // 금액 위변조 검증
            int paidAmount = payment.amount() != null ? payment.amount().paid() : 0;
            if (paidAmount != orderPrice) {
                log.error("결제 금액 위변조 감지: paymentId={}, expected={}, actual={}",
                        paymentId, orderPrice, paidAmount);
                throw new BusinessException(ErrorCode.PAYMENT_AMOUNT_MISMATCH);
            }

            log.info("PortOne 결제 검증 성공: paymentId={}, amount={}", paymentId, paidAmount);
            return payment;

        } catch (BusinessException e) {
            throw e;
        } catch (HttpClientErrorException e) {
            log.error("PortOne API 오류: paymentId={}, status={}, body={}",
                    paymentId, e.getStatusCode(), e.getResponseBodyAsString());
            throw new BusinessException(ErrorCode.PAYMENT_VERIFICATION_FAILED);
        } catch (Exception e) {
            log.error("PortOne 결제 검증 중 예외 발생: paymentId={}, error={}", paymentId, e.getMessage(), e);
            throw new BusinessException(ErrorCode.PAYMENT_VERIFICATION_FAILED);
        }
    }
}
