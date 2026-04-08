package com.aimentor.common;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 공개 헬스체크 컨트롤러
 *
 * [의도]
 * 브라우저, 배포 스크립트, 인프라 점검에서 인증 없이 백엔드 생존 여부를 빠르게 확인할 수 있도록 둡니다.
 * 기존 "/" 경로는 Spring Security 보호 대상이라 401 이 나올 수 있으므로, 확인용 주소를 따로 분리합니다.
 */
@RestController
public class HealthCheckController {

    @GetMapping("/api/health")
    public ResponseEntity<ApiResponse<Map<String, String>>> checkHealth() {
        // 순서를 고정한 응답을 내려주면 브라우저와 로그에서 상태를 읽기 편합니다.
        Map<String, String> healthInfo = new LinkedHashMap<>();
        healthInfo.put("status", "정상");
        healthInfo.put("service", "backend");

        return ResponseEntity.ok(ApiResponse.success(healthInfo));
    }
}
