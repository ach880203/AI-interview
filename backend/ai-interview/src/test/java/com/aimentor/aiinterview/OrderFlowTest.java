package com.aimentor.aiinterview;

import com.aimentor.domain.book.BookEntity;
import com.aimentor.domain.book.BookRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 주문 생성과 결제 결과 반영 흐름을 검증하는 통합 테스트입니다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
@DisplayName("주문 결제 흐름 통합 테스트")
class OrderFlowTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private BookRepository bookRepository;

    private static final String TEST_EMAIL = "order-test@example.com";
    private static final String TEST_PASSWORD = "password123";

    private Long testBookId;

    @BeforeEach
    void 테스트_데이터_준비() throws Exception {
        Map<String, Object> userRequest = Map.of(
                "email", TEST_EMAIL,
                "password", TEST_PASSWORD,
                "name", "주문테스트"
        );

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(userRequest)))
                .andExpect(status().isCreated());

        BookEntity testBook = BookEntity.builder()
                .title("자바 ORM 표준 JPA 프로그래밍")
                .author("김영한")
                .publisher("에이콘출판사")
                .price(43000)
                .stock(10)
                .description("JPA 기초부터 실무까지 설명하는 테스트 도서")
                .build();

        testBookId = bookRepository.save(testBook).getId();
    }

    @Test
    @DisplayName("도서 목록은 인증 없이도 조회할 수 있다")
    void 도서_목록_비인증_조회() throws Exception {
        mockMvc.perform(get("/api/books"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.content").isArray());
    }

    @Test
    @DisplayName("주문 생성 후에는 결제 대기 상태와 재고 선차감이 반영된다")
    void 주문_생성_후_결제대기와_재고차감() throws Exception {
        String token = 로그인하고_토큰_발급();

        mockMvc.perform(post("/api/orders")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(주문_요청_생성(3))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.status").value("PENDING"))
                .andExpect(jsonPath("$.data.ordererName").value("주문 테스트 사용자"))
                .andExpect(jsonPath("$.data.ordererPhone").value("010-1234-5678"))
                .andExpect(jsonPath("$.data.postalCode").value("06236"))
                .andExpect(jsonPath("$.data.paymentMethod").value("KAKAOPAY"));

        BookEntity updatedBook = bookRepository.findById(testBookId).orElseThrow();
        assertThat(updatedBook.getStock()).isEqualTo(7);
    }

    @Test
    @DisplayName("주문서에서 기본 배송지 저장을 선택하면 내 정보에도 같은 배송지가 저장된다")
    void 주문_기본배송지_저장() throws Exception {
        String token = 로그인하고_토큰_발급();

        mockMvc.perform(post("/api/orders")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(주문_요청_생성(1, true))))
                .andExpect(status().isCreated());

        mockMvc.perform(get("/api/auth/me")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.shippingPostalCode").value("06236"))
                .andExpect(jsonPath("$.data.shippingAddress").value("서울시 강남구 테헤란로 123"))
                .andExpect(jsonPath("$.data.shippingDetailAddress").value("10층"));
    }

    @Test
    @DisplayName("결제 승인 후 주문은 결제 완료 상태가 되고 목록에서도 같은 상태로 보인다")
    void 결제_승인_후_PAID_상태가_된다() throws Exception {
        String token = 로그인하고_토큰_발급();
        long orderId = 주문을_생성하고_ID를_가져온다(token, 1);

        mockMvc.perform(patch("/api/orders/{id}/payment", orderId)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "resultType", "APPROVED"
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.status").value("PAID"));

        mockMvc.perform(get("/api/orders")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].status").value("PAID"));
    }

    @Test
    @DisplayName("결제 실패 후에는 재고가 복구되고 주문 상태가 PAYMENT_FAILED로 남는다")
    void 결제_실패_후_재고복구와_실패상태가_남는다() throws Exception {
        String token = 로그인하고_토큰_발급();
        long orderId = 주문을_생성하고_ID를_가져온다(token, 2);

        mockMvc.perform(patch("/api/orders/{id}/payment", orderId)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "resultType", "FAILED",
                                "reason", "카카오페이 승인 실패"
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.status").value("PAYMENT_FAILED"));

        BookEntity restoredBook = bookRepository.findById(testBookId).orElseThrow();
        assertThat(restoredBook.getStock()).isEqualTo(10);
    }

    @Test
    @DisplayName("재고 부족 주문은 OUT_OF_STOCK 오류를 반환한다")
    void 재고_부족_주문은_실패한다() throws Exception {
        String token = 로그인하고_토큰_발급();

        mockMvc.perform(post("/api/orders")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(주문_요청_생성(99))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.error.code").value("OUT_OF_STOCK"));
    }

    @Test
    @DisplayName("인증 없이 주문 생성하면 401이 반환된다")
    void 인증_없이_주문하면_401이_반환된다() throws Exception {
        mockMvc.perform(post("/api/orders")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(주문_요청_생성(1))))
                .andExpect(status().isUnauthorized());
    }

    /**
     * 로그인 후 accessToken을 반환합니다.
     */
    private String 로그인하고_토큰_발급() throws Exception {
        Map<String, Object> loginRequest = Map.of(
                "email", TEST_EMAIL,
                "password", TEST_PASSWORD
        );

        MvcResult result = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loginRequest)))
                .andExpect(status().isOk())
                .andReturn();

        String token = objectMapper.readTree(result.getResponse().getContentAsString())
                .path("data")
                .path("accessToken")
                .asText();

        assertThat(token).isNotBlank();
        return token;
    }

    /**
     * 테스트용 주문 요청 본문을 만듭니다.
     */
    private Map<String, Object> 주문_요청_생성(int quantity) {
        return 주문_요청_생성(quantity, false);
    }

    /**
     * 상세 주소와 기본 배송지 저장 여부까지 포함한 주문 요청 본문을 만듭니다.
     */
    private Map<String, Object> 주문_요청_생성(int quantity, boolean saveShippingInfo) {
        return Map.of(
                "ordererName", "주문 테스트 사용자",
                "ordererPhone", "010-1234-5678",
                "postalCode", "06236",
                "address", "서울시 강남구 테헤란로 123",
                "detailAddress", "10층",
                "paymentMethod", "KAKAOPAY",
                "saveShippingInfo", saveShippingInfo,
                "items", List.of(Map.of("bookId", testBookId, "quantity", quantity))
        );
    }

    /**
     * 주문 생성 응답에서 주문 ID를 꺼냅니다.
     */
    private long 주문을_생성하고_ID를_가져온다(String token, int quantity) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/orders")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(주문_요청_생성(quantity))))
                .andExpect(status().isCreated())
                .andReturn();

        long orderId = objectMapper.readTree(result.getResponse().getContentAsString())
                .path("data")
                .path("id")
                .asLong();

        assertThat(orderId).isPositive();
        return orderId;
    }
}
