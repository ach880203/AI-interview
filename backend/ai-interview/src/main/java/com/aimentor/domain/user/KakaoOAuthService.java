package com.aimentor.domain.user;

import com.aimentor.common.BusinessException;
import com.aimentor.common.ErrorCode;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;

/**
 * 카카오 OAuth 2.0 서비스
 *
 * [역할]
 * 카카오 인가 코드 → 액세스 토큰 교환 → 사용자 정보(이메일, 닉네임) 조회를 담당합니다.
 *
 * [OAuth 2.0 Authorization Code Flow]
 * 1. 프론트엔드: 카카오 인가 서버로 리다이렉트 → 사용자 동의 → 인가 코드 획득
 * 2. 백엔드(이 클래스):
 *    - getAccessToken(code): 인가 코드 → 카카오 토큰 API → access_token 획득
 *    - getUserInfo(accessToken): access_token → 카카오 사용자 정보 API → 이메일/닉네임 획득
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class KakaoOAuthService {

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    /** 카카오 REST API 키 (환경변수: KAKAO_CLIENT_ID) */
    @Value("${kakao.client-id:}")
    private String clientId;

    /** 카카오 Client Secret (환경변수: KAKAO_CLIENT_SECRET, 선택) */
    @Value("${kakao.client-secret:}")
    private String clientSecret;

    /** 인가 코드를 받은 프론트엔드 콜백 URL */
    @Value("${kakao.redirect-uri:http://localhost:5173/auth/kakao/callback}")
    private String redirectUri;

    /** 카카오 토큰 발급 API */
    private static final String TOKEN_URL = "https://kauth.kakao.com/oauth/token";

    /** 카카오 사용자 정보 조회 API */
    private static final String USER_INFO_URL = "https://kapi.kakao.com/v2/user/me";

    /**
     * 인가 코드를 카카오 액세스 토큰으로 교환합니다.
     *
     * [요청]
     * POST https://kauth.kakao.com/oauth/token
     * Content-Type: application/x-www-form-urlencoded
     *
     * @param code 카카오 인가 서버에서 발급한 인가 코드
     * @return 카카오 액세스 토큰 문자열
     */
    public String getAccessToken(String code) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

        MultiValueMap<String, String> params = new LinkedMultiValueMap<>();
        params.add("grant_type", "authorization_code");
        params.add("client_id", clientId);
        params.add("redirect_uri", redirectUri);
        params.add("code", code);

        // client_secret이 설정된 경우에만 추가 (카카오 앱 설정에 따라 선택)
        if (clientSecret != null && !clientSecret.isBlank()) {
            params.add("client_secret", clientSecret);
        }

        HttpEntity<MultiValueMap<String, String>> request = new HttpEntity<>(params, headers);

        try {
            ResponseEntity<String> response = restTemplate.postForEntity(TOKEN_URL, request, String.class);
            JsonNode body = objectMapper.readTree(response.getBody());

            if (body.has("error")) {
                log.error("카카오 토큰 교환 실패: error={}, description={}",
                        body.get("error").asText(), body.get("error_description").asText());
                throw new BusinessException(ErrorCode.AI_SERVER_ERROR);
            }

            String accessToken = body.get("access_token").asText();
            log.debug("카카오 토큰 교환 성공");
            return accessToken;

        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            log.error("카카오 토큰 교환 중 예외 발생: {}", e.getMessage(), e);
            throw new BusinessException(ErrorCode.AI_SERVER_ERROR);
        }
    }

    /**
     * 카카오 액세스 토큰으로 사용자 정보를 조회합니다.
     *
     * [요청]
     * GET https://kapi.kakao.com/v2/user/me
     * Authorization: Bearer {access_token}
     *
     * [응답 구조]
     * {
     *   "kakao_account": {
     *     "email": "user@example.com",
     *     "profile": { "nickname": "홍길동" }
     *   }
     * }
     *
     * @param accessToken 카카오 액세스 토큰
     * @return KakaoUserInfo (이메일, 닉네임)
     */
    public KakaoUserInfo getUserInfo(String accessToken) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(accessToken);

        HttpEntity<Void> request = new HttpEntity<>(headers);

        try {
            ResponseEntity<String> response = restTemplate.exchange(
                    USER_INFO_URL, HttpMethod.GET, request, String.class);
            JsonNode body = objectMapper.readTree(response.getBody());

            JsonNode account = body.path("kakao_account");
            String email = account.path("email").asText(null);
            String nickname = account.path("profile").path("nickname").asText("카카오 사용자");

            if (email == null || email.isBlank()) {
                log.error("카카오 사용자 정보에 이메일이 없습니다. 앱 설정에서 이메일 동의 항목을 확인하세요.");
                throw new BusinessException(ErrorCode.VALIDATION_ERROR);
            }

            log.debug("카카오 사용자 정보 조회 성공: email={}", email);
            return new KakaoUserInfo(email, nickname);

        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            log.error("카카오 사용자 정보 조회 중 예외 발생: {}", e.getMessage(), e);
            throw new BusinessException(ErrorCode.AI_SERVER_ERROR);
        }
    }

    /**
     * 카카오 사용자 정보 내부 DTO
     *
     * @param email    카카오 계정 이메일
     * @param nickname 카카오 프로필 닉네임
     */
    public record KakaoUserInfo(String email, String nickname) {}
}
