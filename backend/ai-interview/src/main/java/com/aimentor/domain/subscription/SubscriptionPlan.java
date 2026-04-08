package com.aimentor.domain.subscription;

import com.aimentor.common.BusinessException;
import com.aimentor.common.ErrorCode;

import java.util.Arrays;

/**
 * 구독 요금제 정의입니다.
 *
 * [설계 이유]
 * 가격과 이용 일수를 백엔드가 직접 알고 있어야
 * 프런트에서 잘못된 금액이나 기간을 보내더라도 서버가 기준값으로 저장할 수 있습니다.
 */
public enum SubscriptionPlan {
    DAILY("daily", "하루", 1, 1100, "가볍게 체험"),
    WEEKLY("weekly", "1주", 7, 6160, "단기 집중 준비"),
    MONTHLY("monthly", "1개월", 30, 21450, "가장 균형 잡힌 선택"),
    YEARLY("yearly", "1년", 365, 200750, "장기 취업 준비 전용");

    private final String key;
    private final String displayName;
    private final int durationDays;
    private final int paymentAmount;
    private final String highlight;

    SubscriptionPlan(String key, String displayName, int durationDays, int paymentAmount, String highlight) {
        this.key = key;
        this.displayName = displayName;
        this.durationDays = durationDays;
        this.paymentAmount = paymentAmount;
        this.highlight = highlight;
    }

    public String getKey() {
        return key;
    }

    public String getDisplayName() {
        return displayName;
    }

    public int getDurationDays() {
        return durationDays;
    }

    public int getPaymentAmount() {
        return paymentAmount;
    }

    public String getHighlight() {
        return highlight;
    }

    /**
     * 프런트가 보내 준 요금제 키를 서버 기준 요금제로 변환합니다.
     *
     * [주의]
     * 존재하지 않는 키를 그대로 저장하면 프런트와 백엔드의 구독 화면이 어긋날 수 있으므로
     * 여기서 즉시 막아 줍니다.
     */
    public static SubscriptionPlan fromKey(String planKey) {
        return Arrays.stream(values())
                .filter(plan -> plan.key.equalsIgnoreCase(planKey))
                .findFirst()
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.VALIDATION_ERROR,
                        "지원하지 않는 구독 요금제입니다."
                ));
    }
}
