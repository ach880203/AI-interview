package com.aimentor.domain.support;

import com.aimentor.domain.support.dto.CustomerCenterFaqCreateRequestDto;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * 기본 FAQ 초기화기입니다.
 *
 * [역할]
 * FAQ 테이블이 비어 있을 때만 기본 안내 문구를 넣어
 * 고객센터 첫 화면이 빈 상태로 보이지 않도록 합니다.
 *
 * [주의]
 * 한 번이라도 운영자가 FAQ를 등록해 두었다면 count가 0이 아니므로
 * 다음 기동 때 기존 운영 데이터를 덮어쓰지 않습니다.
 */
@Component
@RequiredArgsConstructor
public class CustomerCenterFaqInitializer implements ApplicationRunner {

    private final CustomerCenterFaqRepository customerCenterFaqRepository;
    private final CustomerCenterFaqService customerCenterFaqService;

    @Override
    public void run(ApplicationArguments args) {
        if (customerCenterFaqRepository.count() > 0) {
            return;
        }

        List<CustomerCenterFaqCreateRequestDto> defaultFaqs = List.of(
                new CustomerCenterFaqCreateRequestDto(
                        "면접",
                        "AI 음성 질문이 바로 재생되지 않을 때가 있나요?",
                        "브라우저와 네트워크 상태에 따라 AI 음성 준비에 몇 초 정도 걸릴 수 있습니다. 질문 카드 아래의 안내 문구가 보일 때는 잠시만 기다려주세요."
                ),
                new CustomerCenterFaqCreateRequestDto(
                        "학습",
                        "학습이나 면접을 중간에 종료해도 결과를 받을 수 있나요?",
                        "네. 지금까지 완료한 문제와 답변만 기준으로 부분 완료 결과를 확인할 수 있습니다. 아직 아무것도 풀지 않았거나 답하지 않았다면 점수 대신 종료 안내만 보여드립니다."
                ),
                new CustomerCenterFaqCreateRequestDto(
                        "구독",
                        "구독과 도서 구매는 같은 결제인가요?",
                        "아닙니다. 구독은 AI 면접과 학습 기능 이용권이고, 도서 구매는 별도의 주문 흐름으로 관리됩니다. 메뉴 구조도 점차 분리해 더 명확하게 정리할 예정입니다."
                )
        );

        defaultFaqs.forEach(customerCenterFaqService::createFaq);
    }
}
