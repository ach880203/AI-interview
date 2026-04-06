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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 주문 후속 액션(취소, 환불 요청) 통합 테스트
 *
 * [테스트 전략]
 * 주문 생성 후 취소 및 환불 요청의 상태 전환 흐름을 검증합니다.
 *
 * [검증 대상 시나리오]
 * 1. 주문 생성(PENDING) → 취소 요청 → CANCEL_REQUESTED 상태 확인
 *    (관리자 승인 후 CANCELLED로 전환되는 흐름은 AdminService에서 처리)
 * 2. 이미 취소 요청된 주문에 재취소 시도 → 오류 반환
 * 3. 인증 없이 주문 취소 시도 → 401 반환
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
@DisplayName("주문 후속 액션 통합 테스트")
class OrderActionFlowTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private BookRepository bookRepository;

    private static final String TEST_EMAIL = "order-action@example.com";
    private static final String TEST_PASSWORD = "password123";

    private Long testBookId;

    @BeforeEach
    void 테스트_데이터_준비() throws Exception {
        // 1. 사용자 등록
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "email", TEST_EMAIL,
                                "password", TEST_PASSWORD,
                                "name", "주문액션테스트"
                        ))))
                .andExpect(status().isCreated());

        // 2. 테스트 도서 저장
        BookEntity book = BookEntity.builder()
                .title("Clean Code")
                .author("Robert C. Martin")
                .publisher("Pearson Education")
                .price(33000)
                .stock(10)
                .description("클린 코드 작성 가이드")
                .build();

        testBookId = bookRepository.save(book).getId();
    }

    @Test
    @DisplayName("주문 생성 후 취소하면 CANCEL_REQUESTED 상태가 되어야 한다")
    void 주문_생성_후_취소() throws Exception {
        String token = 로그인하여_토큰_획득();

        // 주문 생성 (PENDING 상태)
        long orderId = 주문_생성하고_ID_획득(token);

        // 주문 취소 요청 → 관리자 승인 대기 상태(CANCEL_REQUESTED)로 전환
        Map<String, Object> cancelRequest = Map.of("reason", "단순 변심");

        mockMvc.perform(patch("/api/orders/{id}/cancel", orderId)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(cancelRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.status").value("CANCEL_REQUESTED"));
    }

    @Test
    @DisplayName("이미 취소 요청된 주문을 재취소하면 오류가 반환되어야 한다")
    void 이미_취소된_주문_재취소_실패() throws Exception {
        String token = 로그인하여_토큰_획득();
        long orderId = 주문_생성하고_ID_획득(token);

        // 첫 번째 취소 → CANCEL_REQUESTED 상태
        mockMvc.perform(patch("/api/orders/{id}/cancel", orderId)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("reason", "첫 번째 취소"))))
                .andExpect(status().isOk());

        // 두 번째 취소 시도 — 이미 취소 요청됐으므로 실패해야 함
        mockMvc.perform(patch("/api/orders/{id}/cancel", orderId)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("reason", "두 번째 취소 시도"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));
    }

    @Test
    @DisplayName("인증 없이 주문 취소를 시도하면 401이 반환되어야 한다")
    void 인증없이_주문_취소_거부() throws Exception {
        mockMvc.perform(patch("/api/orders/{id}/cancel", 999L)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("reason", "인증 없음"))))
                .andExpect(status().isUnauthorized());
    }

    // ──────────────────────────────────────────────────────
    // 헬퍼 메서드
    // ──────────────────────────────────────────────────────

    String 로그인하여_토큰_획득() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "email", TEST_EMAIL,
                                "password", TEST_PASSWORD
                        ))))
                .andExpect(status().isOk())
                .andReturn();

        String token = objectMapper.readTree(result.getResponse().getContentAsString())
                .path("data").path("accessToken").asText();
        assertThat(token).isNotBlank();
        return token;
    }

    long 주문_생성하고_ID_획득(String token) throws Exception {
        Map<String, Object> orderRequest = Map.of(
                "ordererName", "주문 액션 테스트 사용자",
                "ordererPhone", "010-9876-5432",
                "postalCode", "06236",
                "address", "서울시 강남구 테헤란로 123",
                "detailAddress", "15층",
                "paymentMethod", "KAKAOPAY",
                "saveShippingInfo", false,
                "items", List.of(Map.of("bookId", testBookId, "quantity", 1))
        );

        MvcResult result = mockMvc.perform(post("/api/orders")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(orderRequest)))
                .andExpect(status().isCreated())
                .andReturn();

        long orderId = objectMapper.readTree(result.getResponse().getContentAsString())
                .path("data").path("id").asLong();
        assertThat(orderId).isPositive();
        return orderId;
    }
}
