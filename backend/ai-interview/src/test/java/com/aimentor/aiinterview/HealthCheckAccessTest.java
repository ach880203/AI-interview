package com.aimentor.aiinterview;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 공개 헬스체크 접근 테스트
 *
 * [의도]
 * 운영 배포 전후에 가장 먼저 확인할 주소가 인증 없이 열려야 하므로 보안 설정 회귀를 막습니다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
@DisplayName("헬스체크 접근 테스트")
class HealthCheckAccessTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    @DisplayName("헬스체크는 인증 없이 접근 가능해야 한다")
    void 공개_헬스체크_조회() throws Exception {
        mockMvc.perform(get("/api/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.status").value("정상"))
                .andExpect(jsonPath("$.data.service").value("backend"));
    }
}
