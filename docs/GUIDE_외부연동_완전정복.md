# 외부 서비스 연동 완전 정복 가이드
## 카카오 OAuth · PortOne 결제 · Vector DB + RAG

> 이 문서는 카카오 로그인, PortOne 결제, Vector DB + RAG를 처음 배우는 사람을 위해 작성했습니다.
> "왜 이 구조인가", "어떻게 동작하는가", "코드를 어떻게 쓰는가"를 실물 코드와 함께 설명합니다.

---

## 목차

1. [카카오 OAuth 2.0 로그인](#1-카카오-oauth-20-로그인)
2. [PortOne V2 결제 SDK](#2-portone-v2-결제-sdk)
3. [Vector DB + RAG (다음 단계)](#3-vector-db--rag)

---

# 1. 카카오 OAuth 2.0 로그인

## 1-1. OAuth 2.0이란?

**OAuth(Open Authorization)**는 "다른 서비스의 계정으로 우리 서비스에 로그인하게 해주는 표준 프로토콜"입니다.

쉽게 비유하면:

```
일반 로그인:    사용자가 우리 서버에 ID/PW 직접 저장
                → 우리가 비밀번호를 관리해야 함 (책임 무거움)

OAuth 로그인:   "카카오가 이 사람이 맞다고 보증해줘"
                → 우리는 JWT만 발급하면 됨 (책임 가벼움)
```

---

## 1-2. Authorization Code Flow (인가 코드 방식)

카카오 OAuth는 **Authorization Code Flow**를 사용합니다.
이 흐름을 단계별로 그림으로 표현하면:

```
[사용자]         [우리 프론트엔드]        [카카오 서버]         [우리 백엔드]
   │                   │                      │                    │
   │  로그인 버튼 클릭  │                      │                    │
   │──────────────────>│                      │                    │
   │                   │                      │                    │
   │                   │── 카카오 인가 페이지로 리다이렉트 ──────>│
   │                   │  (client_id, redirect_uri 포함)           │
   │                   │                      │                    │
   │  카카오 로그인 동의 화면 표시             │                    │
   │<──────────────────────────────────────────                    │
   │                   │                      │                    │
   │  동의 완료         │                      │                    │
   │──────────────────────────────────────────>                    │
   │                   │                      │                    │
   │                   │<── redirect_uri로 인가 코드(code) 전달    │
   │                   │   /auth/kakao/callback?code=XXXXX         │
   │                   │                      │                    │
   │                   │── POST /api/auth/kakao { code } ─────────>│
   │                   │                      │                    │
   │                   │                      │<── code로 access_token 요청
   │                   │                      │    카카오 토큰 API  │
   │                   │                      │───────────────────>│
   │                   │                      │<───────────────────│
   │                   │                      │    access_token     │
   │                   │                      │                    │
   │                   │                      │  access_token으로 사용자 정보 조회
   │                   │                      │  카카오 사용자 API  │
   │                   │                      │───────────────────>│
   │                   │                      │<───────────────────│
   │                   │                      │  이메일, 닉네임     │
   │                   │                      │                    │
   │                   │                      │  DB에서 사용자 조회/생성
   │                   │                      │  JWT 발급           │
   │                   │<── { accessToken, refreshToken, user } ───│
   │                   │                      │                    │
   │  대시보드로 이동   │                      │                    │
   │<──────────────────│                      │                    │
```

**핵심 포인트:**
- `code`는 카카오에서 딱 한 번 발급하는 **1회용 인가 코드**입니다
- 프론트엔드는 `code`를 백엔드로 넘기고, **이후 카카오 API 호출은 전부 백엔드가 합니다**
- 왜냐하면 카카오 `client_secret`을 프론트에 노출하면 보안 위험이 있기 때문입니다

---

## 1-3. 카카오 개발자 콘솔 설정 방법

### 1단계: 카카오 개발자 계정 만들기

1. https://developers.kakao.com 접속
2. 카카오 계정으로 로그인
3. 상단 "내 애플리케이션" → "애플리케이션 추가하기" 클릭

### 2단계: 앱 설정

```
앱 이름: AI 면접 멘토 (임의 입력)
회사명:  개인 (임의 입력)
```

### 3단계: 플랫폼 등록

좌측 메뉴 → "플랫폼" → "Web 플랫폼 등록"

```
사이트 도메인: http://localhost:5173
```

### 4단계: 카카오 로그인 활성화

좌측 메뉴 → "카카오 로그인" → 활성화 ON

```
Redirect URI 등록:
  http://localhost:5173/auth/kakao/callback
```

### 5단계: 동의 항목 설정

좌측 메뉴 → "동의 항목"

```
카카오 계정(이메일) → "필수 동의"로 변경  ← 매우 중요!
닉네임 → "필수 동의"로 변경
```

> ⚠️ **이메일 동의를 "필수"로 설정하지 않으면** 백엔드에서 이메일이 null로 들어와서 오류가 납니다.

### 6단계: 키 확인

좌측 메뉴 → "앱 키"

```
JavaScript 키  → VITE_KAKAO_JS_KEY (프론트엔드 .env에 사용)
REST API 키    → KAKAO_CLIENT_ID   (백엔드 .env에 사용)
```

> Client Secret(보안): 좌측 메뉴 → "카카오 로그인" → "보안" → Client Secret 코드 생성

---

## 1-4. 환경 변수 설정

### 백엔드 (`.env` 파일 생성)

```bash
# backend/ai-interview/.env
KAKAO_CLIENT_ID=발급받은_REST_API_키_입력
KAKAO_CLIENT_SECRET=발급받은_Client_Secret_입력  # 선택 사항
KAKAO_REDIRECT_URI=http://localhost:5173/auth/kakao/callback
```

### 프론트엔드 (`.env.local` 파일 생성)

```bash
# frontend/.env.local
VITE_KAKAO_JS_KEY=발급받은_JavaScript_키_입력
```

---

## 1-5. 코드 동작 원리 (실물 코드 해설)

### [프론트엔드] LoginPage.jsx — 카카오 버튼 클릭

```jsx
// frontend/src/pages/auth/LoginPage.jsx

<button
  onClick={() => {
    // 1. 환경변수에서 카카오 JavaScript 키를 읽습니다
    const kakaoClientId = import.meta.env.VITE_KAKAO_JS_KEY;

    // 2. 카카오 로그인 후 돌아올 우리 서비스 주소
    const redirectUri = `${window.location.origin}/auth/kakao/callback`;
    //  → 로컬: http://localhost:5173/auth/kakao/callback
    //  → 운영: https://우리도메인.com/auth/kakao/callback

    // 3. 카카오 인가 서버로 리다이렉트
    //    사용자가 카카오 로그인 동의 화면을 봅니다
    window.location.href =
      `https://kauth.kakao.com/oauth/authorize` +
      `?client_id=${kakaoClientId}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code`;  // ← 인가 코드 방식 선택
  }}
>
  카카오 로그인
</button>
```

**무슨 일이 일어나냐면:**
1. 사용자가 버튼 클릭
2. 브라우저가 `kauth.kakao.com`으로 이동
3. 카카오 로그인 화면 표시
4. 동의 완료 시 `?code=XXXXX`를 붙여 우리 callback URL로 돌아옴

---

### [프론트엔드] KakaoCallbackPage.jsx — 인가 코드 받기

```jsx
// frontend/src/pages/auth/KakaoCallbackPage.jsx

export default function KakaoCallbackPage() {
  const [searchParams] = useSearchParams();
  const setTokens = useAuthStore((state) => state.setTokens);
  const setUser = useAuthStore((state) => state.setUser);

  useEffect(() => {
    // URL에서 카카오가 전달한 인가 코드 추출
    // 예: /auth/kakao/callback?code=ABCDE12345
    const code = searchParams.get('code');

    async function handleKakaoLogin() {
      // 백엔드로 인가 코드 전송
      // 이후 복잡한 카카오 API 호출은 백엔드가 대신 처리합니다
      const response = await api.post('/api/auth/kakao', { code });
      const data = response.data?.data;

      // 받은 JWT 토큰을 zustand 스토어에 저장
      setTokens(data.accessToken, data.refreshToken);
      setUser(data.user);

      navigate('/dashboard');
    }

    handleKakaoLogin();
  }, []);
}
```

---

### [백엔드] KakaoOAuthService.java — 실제 카카오 API 호출

```java
// backend/.../domain/user/KakaoOAuthService.java

@Service
public class KakaoOAuthService {

    // ── Step 1: 인가 코드 → 카카오 액세스 토큰 교환 ──────────────

    public String getAccessToken(String code) {
        // POST https://kauth.kakao.com/oauth/token
        // 요청 본문(Form Data):
        //   grant_type=authorization_code
        //   client_id=우리_앱의_REST_API_키
        //   redirect_uri=http://localhost:5173/auth/kakao/callback
        //   code=프론트에서_받은_인가_코드

        MultiValueMap<String, String> params = new LinkedMultiValueMap<>();
        params.add("grant_type", "authorization_code");
        params.add("client_id", clientId);         // application.yml에서 주입
        params.add("redirect_uri", redirectUri);    // application.yml에서 주입
        params.add("code", code);                   // 프론트에서 전달받은 값

        ResponseEntity<String> response = restTemplate.postForEntity(
            "https://kauth.kakao.com/oauth/token",
            new HttpEntity<>(params, headers),
            String.class
        );

        // 응답 예시:
        // {
        //   "access_token": "XXXXX",
        //   "token_type": "bearer",
        //   "refresh_token": "YYYYY",
        //   "expires_in": 21599
        // }
        JsonNode body = objectMapper.readTree(response.getBody());
        return body.get("access_token").asText();
    }

    // ── Step 2: 카카오 액세스 토큰 → 사용자 정보 조회 ────────────

    public KakaoUserInfo getUserInfo(String accessToken) {
        // GET https://kapi.kakao.com/v2/user/me
        // 헤더: Authorization: Bearer 카카오_액세스_토큰

        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(accessToken);  // "Authorization: Bearer XXXXX"

        ResponseEntity<String> response = restTemplate.exchange(
            "https://kapi.kakao.com/v2/user/me",
            HttpMethod.GET,
            new HttpEntity<>(headers),
            String.class
        );

        // 응답 예시:
        // {
        //   "kakao_account": {
        //     "email": "user@example.com",
        //     "profile": {
        //       "nickname": "홍길동"
        //     }
        //   }
        // }
        JsonNode body = objectMapper.readTree(response.getBody());
        String email    = body.path("kakao_account").path("email").asText();
        String nickname = body.path("kakao_account").path("profile").path("nickname").asText();

        return new KakaoUserInfo(email, nickname);
    }
}
```

---

### [백엔드] UserService.java — 자동 가입 + JWT 발급

```java
// backend/.../domain/user/UserService.java

@Transactional
public TokenResponseDto kakaoLogin(String code) {

    // 1단계: 카카오에서 사용자 정보 가져오기
    String kakaoAccessToken = kakaoOAuthService.getAccessToken(code);
    KakaoUserInfo kakaoUser = kakaoOAuthService.getUserInfo(kakaoAccessToken);
    //  kakaoUser.email()    → "user@example.com"
    //  kakaoUser.nickname() → "홍길동"

    // 2단계: 이미 가입된 사용자인지 확인
    UserEntity user = userRepository.findByEmail(kakaoUser.email())
        .orElseGet(() -> {
            // 처음 카카오 로그인하는 사람이면 자동으로 회원가입
            UserEntity newUser = UserEntity.builder()
                .email(kakaoUser.email())
                .name(kakaoUser.nickname())
                // 카카오 사용자는 비밀번호 로그인을 막기 위해
                // UUID 랜덤 값을 암호화하여 저장 (추측 불가능)
                .password(passwordEncoder.encode(UUID.randomUUID().toString()))
                .provider("KAKAO")  // 카카오로 가입했음을 표시
                .build();
            return userRepository.save(newUser);
        });

    // 3단계: 우리 서비스의 JWT 발급
    // (카카오 토큰이 아닌 우리 시스템의 JWT입니다)
    String accessToken  = jwtTokenProvider.generateAccessToken(user.getEmail());
    String refreshToken = jwtTokenProvider.generateRefreshToken(user.getEmail());
    saveOrUpdateRefreshToken(user.getEmail(), refreshToken);

    // 4단계: 프론트엔드에 토큰과 사용자 정보 반환
    return TokenResponseDto.of(accessToken, refreshToken, UserResponseDto.from(user));
}
```

---

## 1-6. 자주 발생하는 오류와 해결법

| 오류 | 원인 | 해결 |
|------|------|------|
| `redirect_uri_mismatch` | 카카오 콘솔에 등록한 Redirect URI와 코드의 URI가 다름 | 콘솔에서 정확히 동일하게 등록 |
| `email is null` | 동의 항목에서 이메일을 "선택"으로 설정 | 카카오 콘솔 → 동의항목 → 이메일 "필수 동의"로 변경 |
| `invalid_client` | REST API 키가 틀림 | 카카오 콘솔 → 앱 키 → REST API 키 재확인 |
| 로컬에서 테스트 시 오류 | 카카오 콘솔 플랫폼에 `localhost:5173` 미등록 | 콘솔 → 플랫폼 → Web → `http://localhost:5173` 추가 |

---

---

# 2. PortOne V2 결제 SDK

## 2-1. 결제 연동이란?

인터넷 쇼핑몰에서 "카카오페이로 결제" 버튼을 누르면 어떻게 되는지 생각해보세요.

```
우리 서비스 ──결제 요청──> PG사(PortOne) ──결제 처리──> 카카오페이
우리 서비스 <──결제 결과── PG사(PortOne) <──결제 완료── 카카오페이
```

**PG사(Payment Gateway, 결제 대행사)**: PortOne은 카카오페이, 토스, 네이버페이 등 여러 결제 수단을 한 곳에서 연결해주는 중간 다리입니다.

---

## 2-2. "결제 금액 위변조"란 무엇인가?

결제 연동에서 **가장 중요한 보안 개념**입니다.

```
[나쁜 예 - 위험한 방식]
프론트: "1원짜리 결제로 조작" → PG사에 1원으로 결제 요청
        → 결제 성공!
        → 백엔드에 "결제 성공했어요" 신호만 보냄
백엔드: "오, 결제 성공이네" → 주문 완료 처리
        → 33,000원짜리 책을 1원에 삼!

[올바른 방식 - 서버사이드 검증]
프론트: PG사에 결제 요청 → paymentId 받음
        → 백엔드에 paymentId만 전달
백엔드: PortOne에 직접 조회 → "실제 결제 금액이 33,000원 맞나요?"
        → 우리 DB의 주문 금액과 비교
        → 일치하면 PAID, 불일치하면 결제 실패
```

**핵심 원칙: 프론트의 "결제 성공" 신호를 절대 믿지 말고, 백엔드가 PG사에 직접 확인해야 합니다.**

---

## 2-3. PortOne 관리자 콘솔 설정 방법

### 1단계: 계정 생성

https://admin.portone.io 접속 → 회원가입

### 2단계: 채널 등록

좌측 메뉴 → "결제 연동" → "테스트 환경" → "채널 관리" → "채널 추가"

```
PG사 선택: KakaoPay (카카오페이)
채널 이름: 카카오페이 테스트 (임의 입력)
```

> 테스트 환경에서는 실제 돈이 빠져나가지 않습니다. 안심하고 테스트하세요.

### 3단계: 키 확인

좌측 메뉴 → "결제 연동" → "연동 정보"

```
V2 스토어 아이디   → VITE_PORTONE_STORE_ID   (프론트)
V2 채널 키        → VITE_PORTONE_CHANNEL_KEY (프론트)
V2 시크릿 키      → PORTONE_SECRET_KEY       (백엔드, 절대 프론트에 노출 금지!)
```

---

## 2-4. 환경 변수 설정

### 백엔드

```bash
# backend/ai-interview/.env
PORTONE_SECRET_KEY=v2_live_XXXXXXXXXXXXXXXXXXXX  # 또는 테스트용 키
```

### 프론트엔드

```bash
# frontend/.env.local
VITE_PORTONE_STORE_ID=store-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
VITE_PORTONE_CHANNEL_KEY=channel-key-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

> **⚠️ 주의**: `PORTONE_SECRET_KEY`는 절대로 프론트엔드 환경변수에 넣으면 안 됩니다.
> Vite 환경변수(`VITE_*`)는 브라우저 소스 코드에 그대로 노출됩니다.

---

## 2-5. 전체 결제 흐름

```
[사용자]          [프론트엔드]              [우리 백엔드]         [PortOne 서버]
   │                   │                        │                     │
   │  "결제하기" 클릭  │                        │                     │
   │──────────────────>│                        │                     │
   │                   │                        │                     │
   │                   │── 1. 주문 생성 요청 ──>│                     │
   │                   │   POST /api/orders      │                     │
   │                   │<── orderId: 42 반환 ───│                     │
   │                   │                        │                     │
   │                   │── 2. PortOne SDK 결제창 호출                  │
   │                   │   requestPayment({     │                     │
   │                   │     paymentId: "order_42_타임스탬프"           │
   │                   │     totalAmount: 33000 │                     │
   │                   │   })                   │                     │
   │                   │─────────────────────────────────────────────>│
   │                   │                        │                     │
   │  카카오페이 결제창 표시                     │                     │
   │<─────────────────────────────────────────────────────────────────│
   │                   │                        │                     │
   │  결제 완료        │                        │                     │
   │──────────────────>│                        │                     │
   │                   │<── paymentId 반환 ──────────────────────────│
   │                   │   (결제 실패 시 code 반환)                    │
   │                   │                        │                     │
   │                   │── 3. 백엔드에 검증 요청 ──────────────────>  │
   │                   │   POST /api/orders/42/verify-payment          │
   │                   │   { paymentId: "order_42_..." }               │
   │                   │                        │                     │
   │                   │                        │── 4. PortOne에 직접 조회
   │                   │                        │   GET /payments/{paymentId}
   │                   │                        │─────────────────────>│
   │                   │                        │<─────────────────────│
   │                   │                        │   실제 결제 금액: 33000
   │                   │                        │   상태: PAID        │
   │                   │                        │                     │
   │                   │                        │  5. DB 주문 금액과 비교
   │                   │                        │  33000 == 33000 ✓  │
   │                   │                        │  주문 상태 → PAID   │
   │                   │                        │                     │
   │                   │<── 6. 결제 완료 응답 ──│                     │
   │                   │                        │                     │
   │  주문 완료 페이지  │                        │                     │
   │<──────────────────│                        │                     │
```

---

## 2-6. 코드 동작 원리 (실물 코드 해설)

### [프론트엔드] OrderPaymentPage.jsx — PortOne SDK 호출

```jsx
// frontend/src/pages/bookstore/OrderPaymentPage.jsx

import * as PortOne from '@portone/browser-sdk/v2';

// 환경변수에서 PortOne 설정 읽기
const PORTONE_STORE_ID   = import.meta.env.VITE_PORTONE_STORE_ID;
const PORTONE_CHANNEL_KEY = import.meta.env.VITE_PORTONE_CHANNEL_KEY;

async function handlePortOnePayment(createdOrder) {

    // paymentId: 우리가 직접 만드는 고유 결제 ID
    // "order_{주문ID}_{타임스탬프}" 형식으로 만들면 중복 없음
    const paymentId = `order_${createdOrder.id}_${Date.now()}`;

    // ── Step 1: PortOne SDK로 결제창 열기 ─────────────────────────
    const paymentResponse = await PortOne.requestPayment({
        storeId:    PORTONE_STORE_ID,
        channelKey: PORTONE_CHANNEL_KEY,

        paymentId,           // 우리가 만든 고유 결제 ID
        orderName: '도서 구매',    // 결제창에 표시될 주문명
        totalAmount: createdOrder.totalPrice,  // 결제 금액 (원)
        currency: 'CURRENCY_KRW',    // 원화

        payMethod: 'EASY_PAY',   // 간편결제
        easyPay: {
            easyPayProvider: 'EASY_PAY_PROVIDER_KAKAOPAY'  // 카카오페이
        },
    });

    // ── Step 2: 결제 실패/취소 체크 ───────────────────────────────
    if (paymentResponse?.code) {
        // code가 있으면 오류 발생 (사용자가 창을 닫거나 결제 실패)
        setError(`결제 실패: ${paymentResponse.message}`);
        return;
    }

    // ── Step 3: 백엔드에 paymentId 전달하여 서버사이드 검증 ────────
    // paymentId만 보내고 "결제 성공했어요"는 절대 안 보냄
    // 백엔드가 PortOne에 직접 물어봐서 확인함
    const verifyResponse = await verifyOrderPayment(createdOrder.id, { paymentId });
    const confirmedOrder = verifyResponse.data?.data;

    // 검증 통과 시 장바구니 비우고 완료 페이지로 이동
    clearOrderCheckoutDraft();
    clearCart();
    navigate(`/orders/complete/${confirmedOrder.id}`);
}
```

---

### [백엔드] PortOneService.java — PortOne API 직접 조회

```java
// backend/.../external/payment/PortOneService.java

public PortOnePaymentResponseDto verifyPayment(String paymentId, int orderPrice) {

    // ── Step 1: PortOne API로 결제 정보 조회 ────────────────────────
    // GET https://api.portone.io/payments/{paymentId}
    // Authorization: PortOne {시크릿_키}  ← 백엔드에서만 사용

    HttpHeaders headers = new HttpHeaders();
    headers.set("Authorization", "PortOne " + secretKey);  // "PortOne "이 V2 형식

    ResponseEntity<PortOnePaymentResponseDto> response = restTemplate.exchange(
        "https://api.portone.io/payments/" + paymentId,
        HttpMethod.GET,
        new HttpEntity<>(headers),
        PortOnePaymentResponseDto.class
    );

    PortOnePaymentResponseDto payment = response.getBody();
    // payment.status()      → "PAID" (성공) 또는 "FAILED" 등
    // payment.amount().paid() → 실제 결제된 금액

    // ── Step 2: 결제 상태 검증 ──────────────────────────────────────
    if (!"PAID".equals(payment.status())) {
        // PAID가 아니면 결제 실패 처리
        throw new BusinessException(ErrorCode.PAYMENT_VERIFICATION_FAILED);
    }

    // ── Step 3: 금액 위변조 검증 ────────────────────────────────────
    int paidAmount = payment.amount().paid();   // PortOne에서 확인한 실제 금액
    if (paidAmount != orderPrice) {             // 우리 DB의 주문 금액
        // 금액이 다르면 누군가 조작한 것!
        log.error("결제 금액 위변조 감지! 예상={}, 실제={}", orderPrice, paidAmount);
        throw new BusinessException(ErrorCode.PAYMENT_AMOUNT_MISMATCH);
    }

    return payment;  // 검증 통과
}
```

---

### [백엔드] OrderService.java — 주문 PAID 확정

```java
// backend/.../domain/book/OrderService.java

@Transactional
public OrderDetailResponseDto verifyAndConfirmPayment(
    String email, Long orderId, String paymentId
) {
    UserEntity user  = getUser(email);
    OrderEntity order = getOwnedOrder(user, orderId);

    // 이미 PAID인 주문은 다시 처리하지 않음 (멱등성)
    // → Webhook이 두 번 호출되는 경우를 대비
    if (order.getStatus() == OrderEntity.OrderStatus.PAID) {
        return buildOrderDetail(order);
    }

    try {
        // PortOne에서 결제 검증 (금액 포함)
        portOneService.verifyPayment(paymentId, order.getTotalPrice());

        order.markAsPaid();                    // 상태 PENDING → PAID
        cartItemRepository.deleteByUser(user); // 장바구니 비우기

    } catch (BusinessException e) {
        // 검증 실패 시 재고 복구 + 결제 실패 표시
        restoreOrderItemStocks(orderId);
        order.markAsPaymentFailed("검증 실패: " + e.getMessage());
        throw e;  // 프론트에 실패 알림
    }

    return buildOrderDetail(order);
}
```

---

## 2-7. PortOne 없이 로컬 개발하는 법

`VITE_PORTONE_STORE_ID`가 비어 있으면 기존 모의 결제 화면으로 자동 전환됩니다.

```jsx
// OrderPaymentPage.jsx 분기 로직

if (PORTONE_STORE_ID) {
    // 실제 PortOne 결제창 사용
    await handlePortOnePayment(createdOrder);
} else {
    // PortOne 설정 없을 때 → 모의 결제 화면으로 이동
    // /orders/payment/callback/{id} 페이지에서
    // "승인/실패/취소" 버튼으로 직접 선택
    navigate(`/orders/payment/callback/${createdOrder.id}`);
}
```

---

## 2-8. 자주 발생하는 오류와 해결법

| 오류 | 원인 | 해결 |
|------|------|------|
| `CHANNEL_NOT_FOUND` | 채널 키가 틀리거나 미등록 | PortOne 콘솔 → 채널 관리 확인 |
| `UNAUTHORIZED` | 시크릿 키 오류 | PortOne 콘솔 → 연동 정보 재확인 |
| `PAYMENT_AMOUNT_MISMATCH` | 금액 위변조 또는 DB 금액과 불일치 | 정상 케이스라면 `totalPrice` 필드 확인 |
| SDK가 undefined 오류 | `@portone/browser-sdk` 미설치 | `npm install @portone/browser-sdk` |
| 테스트 결제가 실제 차감 | 운영 키로 테스트 중 | 콘솔에서 "테스트 환경" 채널 키 사용 확인 |

---

---

# 3. Vector DB + RAG

## 3-1. 문제 상황: 현재 AI 면접 질문의 한계

현재 면접 질문 생성 흐름:

```python
# ai-server/services/interview_service.py (현재)

def generate_question(resume, cover_letter, job_posting, history):
    prompt = f"""
    이력서: {resume}          ← 최대 수천 글자
    자기소개서: {cover_letter} ← 최대 수천 글자
    채용공고: {job_posting}   ← 최대 수천 글자
    대화 기록: {history}      ← 질문 누적될수록 길어짐
    """
    # GPT-4o에 전부 보냄 → 비용 증가, 품질 저하
```

**문제점:**
1. **비용**: 문서가 길면 길수록 토큰 비용이 선형으로 증가
2. **품질**: GPT-4o는 긴 컨텍스트에서 핵심을 놓치는 경향
3. **확장성**: 문서가 많아질수록 처리 불가

---

## 3-2. RAG란 무엇인가?

**RAG (Retrieval-Augmented Generation)**: "관련된 내용만 골라서 AI에게 주는" 기법

```
[일반 방식]
모든 문서 전체 → GPT에 전달 → 답변

[RAG 방식]
모든 문서 → 벡터 DB에 저장
질문이 들어오면 → 관련 부분만 검색 → GPT에 전달 → 답변
```

**비유**: 책 한 권을 통째로 읽어주는 것 vs. 인덱스(색인)에서 관련 페이지만 찾아서 읽어주는 것

---

## 3-3. 벡터 DB(Vector Database)란?

일반 DB는 **정확한 값**으로 검색합니다:

```sql
-- 일반 DB: 정확한 단어가 있어야 검색됨
SELECT * FROM documents WHERE content LIKE '%Java%'
```

벡터 DB는 **의미적 유사도**로 검색합니다:

```python
# 벡터 DB: "Spring Boot 백엔드 개발"과 의미가 비슷한 문서를 찾음
results = collection.query(
    query_texts=["Spring Boot 백엔드 개발 경험에 대해 물어볼 내용"],
    n_results=3
)
# → "Java 서버 개발", "REST API 구현" 등도 검색됨 (단어가 달라도 OK)
```

---

## 3-4. 임베딩(Embedding)이란?

**임베딩**: 텍스트를 숫자 벡터로 변환하는 것

```
"Java 개발 경험 3년"  → [0.23, -0.45, 0.89, 0.12, ...]  (1536차원 숫자 배열)
"Spring Boot 백엔드" → [0.21, -0.44, 0.91, 0.10, ...]  (비슷한 숫자 → 의미 유사)
"강아지 산책하기"    → [-0.67, 0.34, -0.12, 0.89, ...] (전혀 다른 숫자 → 의미 무관)
```

```
두 벡터의 거리(코사인 유사도)를 계산하면:
"Java 개발" ↔ "Spring Boot" = 0.95 (매우 유사)
"Java 개발" ↔ "강아지 산책" = 0.12 (관련 없음)
```

---

## 3-5. ChromaDB란?

ChromaDB는 **로컬에서 실행되는 오픈소스 벡터 데이터베이스**입니다.

```
MariaDB (일반 DB):  행·열 테이블 구조
ChromaDB (벡터 DB): 컬렉션 → 문서 → 벡터 구조
```

```python
import chromadb

client = chromadb.Client()
collection = client.create_collection("my_documents")

# 문서 저장 (자동으로 임베딩 생성)
collection.add(
    documents=["Java 개발 3년 경험이 있습니다."],
    metadatas=[{"user_id": 1, "doc_type": "resume"}],
    ids=["doc_1"]
)

# 유사한 문서 검색
results = collection.query(
    query_texts=["백엔드 개발 경험"],
    n_results=3
)
```

---

## 3-6. RAG 전체 흐름

```
[문서 업로드 시]

사용자가 이력서 업로드
     │
     ▼
chunk_text():  긴 텍스트를 500자 단위로 잘게 자름
     │   "Java 개발 3년..." (청크 1)
     │   "Spring Boot 사용..." (청크 2)
     │   "AWS 운영 경험..." (청크 3)
     ▼
embed_text():  각 청크를 OpenAI API로 벡터로 변환
     │   [0.23, -0.45, ...] (청크 1의 벡터)
     │   [0.21, -0.44, ...] (청크 2의 벡터)
     │   [0.19, -0.43, ...] (청크 3의 벡터)
     ▼
ChromaDB에 저장



[면접 질문 생성 시]

"기술 면접 질문 생성 요청"
     │
     ▼
search_similar(): "면접 질문과 관련된 청크" 검색
     │   → "Java 개발 3년 경험이 있습니다." (유사도 0.92)
     │   → "Spring Boot 사용해서 API 개발" (유사도 0.89)
     ▼
GPT 프롬프트에 관련 내용만 주입:
     """
     [참고 문서 - 이력서 발췌]
     Java 개발 3년 경험이 있습니다.
     Spring Boot 사용해서 API 개발했습니다.

     위 내용을 바탕으로 심층 면접 질문을 생성해주세요.
     """
     ▼
더 정확하고 개인화된 면접 질문 생성
```

---

## 3-7. 구현할 파일 구조

```
ai-server/
├── services/
│   ├── vector_service.py      ← ChromaDB 저장/검색 (신규)
│   ├── embedding_service.py   ← 텍스트 → 벡터 변환 (신규)
│   └── interview_service.py   ← RAG 적용 (수정)
├── docker-compose.yml         ← ChromaDB 컨테이너 추가 (수정)
└── requirements.txt           ← chromadb, langchain 추가 (수정)
```

---

## 3-8. 핵심 코드 예시 (구현 방향)

### embedding_service.py — 텍스트를 벡터로 변환

```python
# ai-server/services/embedding_service.py

from openai import OpenAI

client = OpenAI()

def embed_text(text: str) -> list[float]:
    """
    텍스트를 1536차원 숫자 벡터로 변환합니다.

    [모델 선택 이유]
    text-embedding-3-small: 빠르고 저렴 ($0.02/1M tokens)
    text-embedding-3-large: 정확하지만 비쌈
    → 면접 질문 수준에서는 small로 충분합니다.
    """
    response = client.embeddings.create(
        input=text,
        model="text-embedding-3-small"
    )
    return response.data[0].embedding  # [0.23, -0.45, 0.89, ...] 1536개 숫자


def chunk_text(text: str, chunk_size: int = 500, overlap: int = 50) -> list[str]:
    """
    긴 텍스트를 겹침이 있는 청크로 나눕니다.

    [overlap이 필요한 이유]
    "...Java를 사용하여 / Spring Boot로 REST API를..."
    딱 잘리면 앞뒤 문맥이 끊겨서 의미가 손실됩니다.
    overlap 50자를 앞뒤로 겹치면 문맥 연결이 자연스럽습니다.
    """
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunks.append(text[start:end])
        start += chunk_size - overlap  # 다음 청크는 50자 뒤로가 아닌 50자 앞에서 시작
    return chunks
```

---

### vector_service.py — ChromaDB 저장/검색

```python
# ai-server/services/vector_service.py

import chromadb
from .embedding_service import embed_text, chunk_text

# ChromaDB 클라이언트 (로컬 또는 Docker 컨테이너)
chroma_client = chromadb.HttpClient(host="localhost", port=8001)

def upsert_document(user_id: int, doc_type: str, doc_id: int, text: str):
    """
    문서를 벡터 DB에 저장합니다.

    [컬렉션 네이밍]
    user_1_resume    → 사용자 1의 이력서
    user_1_cover     → 사용자 1의 자기소개서
    user_2_resume    → 사용자 2의 이력서
    사용자별로 격리해서 데이터가 섞이지 않게 합니다.
    """
    collection_name = f"user_{user_id}_{doc_type}"
    collection = chroma_client.get_or_create_collection(collection_name)

    # 1. 기존 문서 삭제 (upsert 구현)
    existing = collection.get(where={"doc_id": doc_id})
    if existing["ids"]:
        collection.delete(ids=existing["ids"])

    # 2. 긴 문서를 청크로 분할
    chunks = chunk_text(text)

    # 3. 각 청크를 임베딩 + 저장
    for i, chunk in enumerate(chunks):
        chunk_id = f"{doc_type}_{doc_id}_chunk_{i}"
        embedding = embed_text(chunk)  # OpenAI API 호출

        collection.add(
            ids=[chunk_id],
            embeddings=[embedding],
            documents=[chunk],
            metadatas=[{"doc_id": doc_id, "chunk_index": i}]
        )


def search_similar(user_id: int, doc_type: str, query: str, top_k: int = 3) -> list[str]:
    """
    쿼리와 의미적으로 유사한 문서 청크를 반환합니다.

    [동작 원리]
    1. 쿼리 텍스트를 벡터로 변환
    2. 저장된 모든 청크 벡터와 코사인 유사도 계산
    3. 유사도 높은 순서로 top_k개 반환
    """
    collection_name = f"user_{user_id}_{doc_type}"

    try:
        collection = chroma_client.get_collection(collection_name)
    except Exception:
        return []  # 저장된 문서 없으면 빈 리스트

    query_embedding = embed_text(query)

    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=top_k
    )

    return results["documents"][0]  # 관련 텍스트 청크 리스트
```

---

### interview_service.py — RAG 적용

```python
# ai-server/services/interview_service.py (수정)

from .vector_service import search_similar

def generate_question(user_id, resume, cover_letter, job_posting, history, question_type):

    # ── RAG: 현재 질문과 관련된 문서 청크만 검색 ────────────────────
    context_chunks = []

    # 이력서에서 관련 부분 검색
    resume_chunks = search_similar(user_id, "resume", history[-200:], top_k=2)
    context_chunks.extend(resume_chunks)

    # 자기소개서에서 관련 부분 검색
    cover_chunks = search_similar(user_id, "cover_letter", history[-200:], top_k=2)
    context_chunks.extend(cover_chunks)

    # 검색된 청크를 컨텍스트로 조합
    rag_context = "\n\n".join(context_chunks) if context_chunks else ""

    # ── GPT 프롬프트 구성 ────────────────────────────────────────────
    system_prompt = f"""
    당신은 전문 면접관입니다.

    [지원자 이력 - 관련 내용 발췌]
    {rag_context}
    ← 전체 문서 대신 관련 부분만! (토큰 절약 + 품질 향상)

    [채용 공고]
    {job_posting[:500]}  ← 채용공고는 비교적 짧으므로 전체 사용 가능

    위 내용을 바탕으로 심층 면접 질문을 한 개 생성해주세요.
    """

    response = openai_client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"대화 기록:\n{history}"}
        ]
    )

    return response.choices[0].message.content
```

---

## 3-9. Docker Compose에 ChromaDB 추가

```yaml
# docker-compose.yml에 추가할 내용

services:
  chromadb:
    image: chromadb/chroma:latest
    ports:
      - "8001:8000"
    volumes:
      - chroma_data:/chroma/chroma  # 데이터 영구 보존
    environment:
      - IS_PERSISTENT=TRUE

volumes:
  chroma_data:  # Docker 볼륨으로 데이터 보존
```

```bash
# 실행 방법
docker-compose up chromadb -d

# 확인
curl http://localhost:8001/api/v1/heartbeat
# → {"nanosecond heartbeat": 1234567890}
```

---

## 3-10. requirements.txt 추가

```
# requirements.txt에 추가

chromadb==0.4.22        # Vector DB 클라이언트
langchain-openai==0.1.8 # OpenAI 임베딩 (선택 - 직접 openai SDK 써도 됨)
tiktoken==0.7.0         # 토큰 수 계산 (청크 크기 최적화용)
```

---

## 3-11. 비용 계산

OpenAI 임베딩 비용 (text-embedding-3-small 기준):

```
이력서 1개 (약 1000자 = ~500 토큰):
  → $0.02 / 1,000,000 tokens × 500 tokens = $0.00001 (약 0.014원)

사용자 1000명이 이력서 업로드:
  → $0.01 (약 14원)

면접 질문 생성 1회 (검색 쿼리 ~200 토큰):
  → $0.000004 (0.005원)
```

**결론: 임베딩 비용은 거의 무시 가능한 수준입니다.**

---

## 3-12. RAG 구현 순서 (다음 작업)

```
1. docker-compose.yml → ChromaDB 컨테이너 추가
2. requirements.txt → chromadb 패키지 추가
3. embedding_service.py 생성 (embed_text, chunk_text)
4. vector_service.py 생성 (upsert_document, search_similar)
5. document.py 라우터 수정 → 업로드 시 vector_service 호출
6. interview_service.py 수정 → 질문 생성 시 RAG 적용
7. 테스트: 이력서 업로드 → 면접 질문 생성이 더 정확해지는지 확인
```

---

---

# 3-13. Vector DB + RAG 실제 구현 코드 완전 해설

> 위 3-1 ~ 3-12는 개념과 방향을 설명한 것입니다.
> 여기서는 **실제 프로젝트에 적용된 코드**를 한 줄씩 해설합니다.
> 처음 접하는 학생 기준으로, 왜 이렇게 썼는지까지 설명합니다.

---

## A. 전체 구조 한눈에 보기

```
[사용자가 이력서 PDF 업로드]
        │
        ▼
  POST /extract/document
  (session_id, doc_id 함께 전달)
        │
        ▼
  document_service.py → 텍스트 추출 (pypdf)
        │
        ▼
  embedding_service.py → chunk_text() 500자 청크 분할
        │
        ▼
  embedding_service.py → embed_texts() OpenAI API 호출 → 1536차원 벡터
        │
        ▼
  vector_service.py → ChromaDB에 저장
  컬렉션명: "session_42" (session_id=42 기준)


[면접 질문 생성 요청]
        │
        ▼
  POST /interview/question
  { sessionId: "42", resumeContent: "...", ... }
        │
        ▼
  interview_service.py → _build_rag_context()
        │
        ▼
  vector_service.py → search_similar() → 관련 청크 3개 검색
        │
        ▼
  GPT 프롬프트에 [참고 자료] 섹션으로 청크 주입
        │
        ▼
  GPT-4o → 이력서 내용 기반 개인화 면접 질문 생성
```

**핵심 아이디어:**
- 이력서가 1만 자라도 GPT에 전부 보내면 토큰 낭비 + 성능 저하
- RAG는 "지금 질문과 관련 있는 500자짜리 조각 3개"만 GPT에 보냄
- GPT는 핵심 정보만 받으니까 더 집중된, 더 개인화된 질문을 만들어냄

---

## B. embedding_service.py — 텍스트를 벡터로 바꾸는 도구

**파일 위치:** `ai-server/services/embedding_service.py`

### B-1. chunk_text() 함수

```python
def chunk_text(text: str, chunk_size: int = 500, overlap: int = 50) -> List[str]:
```

**왜 텍스트를 자르는가?**

```
이력서 원문 (3000자):
"저는 Java 개발자로 3년간 근무했습니다. Spring Boot를 주로 사용했고...
 (중간 생략)
 ...AWS EC2에서 서비스를 운영한 경험이 있습니다."

이것을 하나의 벡터로 만들면:
  → 3000자 전체가 하나의 점(벡터)이 됨
  → "Java 경험"이나 "AWS 경험"이 모두 섞여서 평균화됨
  → 검색하면 전체가 애매하게 나옴

500자씩 자르면:
  청크1: "Java 개발자로 3년간 근무, Spring Boot 사용..." → 벡터 A
  청크2: "팀 프로젝트에서 팀장 역할, 의사소통..."      → 벡터 B
  청크3: "AWS EC2 운영, S3 파일 업로드..."           → 벡터 C

  → "백엔드 경험"을 검색하면 청크1이 정확하게 검색됨
  → "클라우드 경험"을 검색하면 청크3이 정확하게 검색됨
```

**overlap(겹침)이 필요한 이유:**

```
overlap 없이 500자씩 자르면:
  청크1: "...Spring Boot를 사용하여 REST API"
  청크2: "를 개발하고 JPA로 DB 설계를..."

  → "Spring Boot REST API" 문장이 두 청크로 잘려서 의미가 끊김
  → 검색 시 이 청크로는 "Spring Boot REST API 개발" 맥락 파악 불가

overlap=50으로 자르면:
  청크1: "...Spring Boot를 사용하여 REST API"   (마지막 50자 포함)
  청크2: "REST API를 개발하고 JPA로 DB 설계를..."  (앞 50자 겹침)

  → 문장이 양쪽 청크에 걸쳐 있어 문맥 유지됨
```

**실제 동작 코드:**

```python
_CHUNK_SIZE = 500   # 한 청크에 담을 최대 문자 수
_CHUNK_OVERLAP = 50  # 앞뒤 청크가 겹치는 문자 수

def chunk_text(text: str, chunk_size: int = _CHUNK_SIZE, overlap: int = _CHUNK_OVERLAP) -> List[str]:
    if not text or not text.strip():
        return []  # 빈 텍스트면 청크 없음

    chunks: List[str] = []
    start = 0  # 시작 위치

    while start < len(text):
        end = start + chunk_size       # 끝 위치 (500자 뒤)
        chunk = text[start:end].strip()  # 앞뒤 공백 제거

        if chunk:
            chunks.append(chunk)

        # 핵심: 다음 청크 시작은 "500자 앞"이 아니라 "500-50=450자 앞"
        # → 50자 겹치게 해서 문맥 연결
        start = end - overlap

    return chunks
```

**예시:**

```python
text = "A" * 1200  # 1200자짜리 텍스트

chunks = chunk_text(text, chunk_size=500, overlap=50)

# 청크 0: text[0:500]   (0~499)
# 청크 1: text[450:950] (450~949, 앞 50자 겹침)
# 청크 2: text[900:1400] (900~1199, 마지막은 1200자까지만)

print(len(chunks))  # 3
```

---

### B-2. embed_texts() 함수

```python
async def embed_texts(texts: List[str]) -> List[List[float]]:
```

**"async"가 붙은 이유:**
OpenAI API 호출은 네트워크 요청입니다. 응답을 기다리는 동안 다른 요청을 처리하려면 비동기(`async/await`)가 필요합니다.

```
동기(sync) 방식:
  요청1 처리 → OpenAI 기다림(0.5초) → 응답 → 요청2 처리 ...
  총 10개 요청 = 5초

비동기(async) 방식:
  요청1 처리 → OpenAI 기다리는 동안 → 요청2, 3, 4 처리 ...
  총 10개 요청 = ~1초 (훨씬 빠름)
```

**배치(batch) 처리란:**

```python
# 비효율적인 방법 - 하나씩 API 호출 (API 호출 N번)
for chunk in chunks:
    embedding = openai.embed(chunk)  # 매번 HTTP 요청

# 효율적인 방법 - 한 번에 모두 전송 (API 호출 1번)
embeddings = openai.embed(chunks)   # 리스트로 묶어서 한 번에 요청
```

실제 코드:

```python
async def embed_texts(texts: List[str]) -> List[List[float]]:
    if not texts:
        return []  # 빈 리스트면 빈 리스트 반환 (API 호출 안 함)

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="OPENAI_API_KEY가 설정되지 않았습니다.")

    client = AsyncOpenAI(api_key=api_key)  # 비동기 클라이언트

    response = await client.embeddings.create(
        model="text-embedding-3-small",  # 저렴하고 빠른 임베딩 모델
        input=texts,                      # 청크 리스트를 한 번에 전송
    )

    # API 응답: [{"index": 0, "embedding": [0.23, ...]}, {"index": 1, ...}]
    # index 기준으로 정렬 → texts 순서와 일치하도록 보장
    sorted_data = sorted(response.data, key=lambda item: item.index)
    return [item.embedding for item in sorted_data]
    # 반환값: [[0.23, -0.45, ...], [0.21, -0.44, ...], ...]
    #         청크1의 벡터,         청크2의 벡터, ...
```

**반환 값 형태:**

```
texts 입력:
  ["Spring Boot 개발 3년", "AWS EC2 운영 경험"]

반환 값:
  [
    [0.23, -0.45, 0.89, 0.12, ..., 0.34],  # "Spring Boot 개발 3년"의 벡터 (1536개 숫자)
    [0.19, -0.43, 0.91, 0.10, ..., 0.31],  # "AWS EC2 운영 경험"의 벡터 (1536개 숫자)
  ]
```

---

## C. vector_service.py — ChromaDB 저장·검색 관리자

**파일 위치:** `ai-server/services/vector_service.py`

### C-1. 싱글턴 클라이언트 패턴

```python
_chroma_client: Optional[chromadb.ClientAPI] = None  # 전역 변수

def _get_client() -> chromadb.ClientAPI:
    global _chroma_client  # 함수 밖의 전역 변수를 수정하겠다고 선언

    if _chroma_client is not None:
        return _chroma_client  # 이미 만들어진 클라이언트 재사용
```

**싱글턴(Singleton)이란?**

```
나쁜 방법 (매번 새로 연결):
  요청1 → ChromaDB 연결 생성 → 사용 → 연결 종료
  요청2 → ChromaDB 연결 생성 → 사용 → 연결 종료
  요청3 → ChromaDB 연결 생성 → 사용 → 연결 종료
  → 연결 생성/종료 비용이 계속 발생

좋은 방법 (싱글턴 - 한 번만 연결):
  앱 시작 → ChromaDB 연결 생성 (딱 1번)
  요청1 → 같은 연결 재사용
  요청2 → 같은 연결 재사용
  요청3 → 같은 연결 재사용
  → 연결 오버헤드 없음
```

### C-2. 환경별 연결 분기

```python
chroma_host = os.getenv("CHROMA_HOST")  # 환경변수 읽기

if chroma_host:
    # Docker 컨테이너로 ChromaDB가 실행 중인 경우
    # 예: CHROMA_HOST=chromadb (컨테이너명), CHROMA_PORT=8000
    _chroma_client = chromadb.HttpClient(host=chroma_host, port=chroma_port)
else:
    # 로컬 개발 환경 - ChromaDB Docker 없어도 메모리에서 동작
    # 서버 재시작하면 데이터 날아감 (테스트용)
    _chroma_client = chromadb.EphemeralClient()
```

**왜 두 가지 모드가 필요한가?**

```
개발 환경:
  - Docker 없이 코드만 실행해도 RAG 기능 테스트 가능
  - EphemeralClient = 메모리에 저장 (프로세스 종료 시 사라짐)
  - "기능이 동작하는지" 확인하는 용도

운영 환경 (Docker Compose):
  - chromadb 컨테이너 실행 중
  - HttpClient = HTTP로 컨테이너에 연결
  - 데이터가 볼륨에 영구 저장됨
```

### C-3. 컬렉션(Collection)이란?

```
MariaDB 비유:
  ChromaDB 컬렉션 ≈ MariaDB 테이블

우리 프로젝트 설계:
  컬렉션명 = "session_{session_id}"

  사용자 A가 면접 세션 42번:
    컬렉션 "session_42" → A의 이력서 청크들

  사용자 B가 면접 세션 43번:
    컬렉션 "session_43" → B의 이력서 청크들

  → 세션별로 완전히 분리 → 사용자 간 데이터 혼용 없음
```

```python
def _get_collection(session_id: str) -> chromadb.Collection:
    client = _get_client()
    collection_name = f"session_{session_id}"  # "session_42"

    return client.get_or_create_collection(
        name=collection_name,
        metadata={"hnsw:space": "cosine"},  # 코사인 유사도 사용 설정
    )
    # get_or_create: 이미 있으면 그것 반환, 없으면 새로 만들어서 반환
```

**코사인 유사도(cosine)란?**

```
두 벡터의 "방향"이 얼마나 같은지 측정합니다.

예시:
  "Java 백엔드" → 벡터 A = [0.23, -0.45, 0.89, ...]
  "Spring Boot 개발" → 벡터 B = [0.21, -0.44, 0.91, ...]

  두 벡터의 각도가 작다 → 코사인 유사도 높음 (0에 가까운 각도 = 1에 가까운 유사도)
  → 두 텍스트는 의미적으로 비슷하다고 판단

  코사인 유사도 = 1: 완전히 같은 방향 (동일 의미)
  코사인 유사도 = 0: 직각 (관련 없음)
  코사인 유사도 = -1: 반대 방향 (반대 의미)
```

### C-4. upsert_document() — 문서 저장

```python
async def upsert_document(session_id: str, doc_id: str, text: str) -> int:
    chunks = chunk_text(text)  # 1. 텍스트를 500자 청크로 분할

    if not chunks:
        return 0  # 빈 텍스트면 저장 불필요

    # 청크별 고유 ID 생성
    # 예: doc_id="resume.pdf", 청크 0 → "resume.pdf_chunk_0"
    chunk_ids = [f"{doc_id}_chunk_{i}" for i in range(len(chunks))]

    # 각 청크에 대한 메타데이터 (검색 후 어느 문서의 몇 번째 청크인지 알 수 있음)
    chunk_metadatas = [{"doc_id": doc_id, "chunk_index": i} for i in range(len(chunks))]

    # 2. 모든 청크를 한 번에 임베딩 (배치 처리)
    embeddings = await embed_texts(chunks)

    # 3. ChromaDB에 저장
    collection = _get_collection(session_id)
    collection.upsert(          # upsert = update + insert
        ids=chunk_ids,          # ID 목록 (같은 ID가 있으면 덮어씀)
        documents=chunks,       # 원본 텍스트 청크
        embeddings=embeddings,  # 각 청크의 벡터
        metadatas=chunk_metadatas,  # 추가 정보
    )

    return len(chunks)  # 저장된 청크 수 반환
```

**저장 결과 시각화:**

```
ChromaDB "session_42" 컬렉션:

┌──────────────────────────────┬──────────────────────────────────┬──────────────────────┐
│ ID                           │ document (텍스트)                 │ embedding (벡터)     │
├──────────────────────────────┼──────────────────────────────────┼──────────────────────┤
│ resume.pdf_chunk_0           │ 저는 Java 개발자로 3년간...       │ [0.23, -0.45, ...]   │
│ resume.pdf_chunk_1           │ Spring Boot를 사용하여 REST...    │ [0.21, -0.44, ...]   │
│ resume.pdf_chunk_2           │ AWS EC2에서 서비스를 운영...      │ [0.19, -0.43, ...]   │
│ cover.pdf_chunk_0            │ 저는 협업을 중요시 여기며...      │ [0.15, -0.30, ...]   │
└──────────────────────────────┴──────────────────────────────────┴──────────────────────┘
```

### C-5. search_similar() — 유사 청크 검색

```python
async def search_similar(session_id: str, query: str, n_results: int = 3) -> List[str]:
    try:
        collection = _get_collection(session_id)  # 세션 컬렉션 가져오기

        if collection.count() == 0:
            return []  # 저장된 문서 없으면 빈 리스트 (면접 진행 막지 않음)

        # 1. 쿼리 텍스트를 벡터로 변환
        query_embeddings = await embed_texts([query])

        # 2. ChromaDB에서 유사도 검색
        results = collection.query(
            query_embeddings=query_embeddings,
            n_results=min(n_results, collection.count()),  # 저장 수보다 많이 요청하면 오류 방지
        )

        # 3. 결과 구조 이해:
        # results = {
        #   "documents": [["청크A", "청크B", "청크C"]],  ← 2중 리스트!
        #   "distances": [[0.05, 0.12, 0.18]],          ← 유사도 거리
        #   "ids": [["id1", "id2", "id3"]],
        # }
        # [0]이 필요한 이유: 쿼리가 1개이므로 첫 번째 결과만 사용
        documents = results.get("documents", [[]])[0]
        return [doc for doc in documents if doc]  # None 제거

    except Exception as error:
        # 벡터 검색 실패해도 면접 진행은 계속
        # (RAG 없이 기본 GPT로 폴백)
        logger.warning("벡터 검색 실패 (RAG 건너뜀): %s", error)
        return []
```

**검색 동작 시각화:**

```
쿼리: "백엔드 개발 경험"
쿼리 벡터: [0.22, -0.44, 0.90, ...]

ChromaDB에 저장된 청크들과 거리 계산:
  청크0 "Java 개발자 3년..."  → 거리 0.05 (매우 유사) ← 반환
  청크1 "Spring Boot REST..." → 거리 0.12 (유사)      ← 반환
  청크3 "협업을 중요시..."    → 거리 0.45 (관련 없음)
  청크2 "AWS EC2 운영..."    → 거리 0.18 (약간 유사)  ← 반환

n_results=3이면 거리 낮은 순 3개 반환:
  → ["Java 개발자 3년...", "Spring Boot REST...", "AWS EC2 운영..."]
```

---

## D. document.py 라우터 — 업로드 즉시 벡터 저장

**파일 위치:** `ai-server/routers/document.py`

```python
@router.post("/document")
async def extract_document(
    request: Request,
    file: UploadFile = File(...),        # 업로드된 파일
    session_id: Optional[str] = Form(None),  # 세션 ID (선택)
    doc_id: Optional[str] = Form(None),      # 문서 ID (선택)
) -> DocumentExtractResponse:
```

**Form과 File을 동시에 받는 방법:**

```
일반 JSON 요청:
  Content-Type: application/json
  { "session_id": "42", "doc_id": "resume" }
  → JSON 바디로 파라미터 전달

파일 + 추가 데이터:
  Content-Type: multipart/form-data
  파일 데이터 + 텍스트 필드 (Form) 를 함께 전송
  → File과 Form을 함께 사용
```

**프론트엔드에서 호출하는 방법 예시:**

```javascript
// JavaScript (프론트엔드)
const formData = new FormData();
formData.append('file', pdfFile);          // 파일
formData.append('session_id', '42');       // 세션 ID (문자열)
formData.append('doc_id', 'resume.pdf');   // 문서 ID (문자열)

await fetch('/extract/document', {
  method: 'POST',
  body: formData,
  // Content-Type 헤더 직접 설정하면 안 됨 - 브라우저가 자동으로 설정
});
```

**백엔드 처리 흐름:**

```python
# 1. 파일에서 텍스트 추출 (항상 실행)
extracted_text = await extract_document_text(file)

# 2. session_id가 있으면 벡터 저장 (선택적)
if session_id:
    effective_doc_id = doc_id or (file.filename or "unknown")
    try:
        chunk_count = await upsert_document(session_id, effective_doc_id, extracted_text)
        # 성공 시 로그
    except Exception as error:
        # 벡터 저장 실패해도 텍스트 추출 결과는 정상 반환
        # → 부분 실패 허용 (Graceful Degradation)
        logger.warning("벡터 저장 실패: %s", error)

# 3. 항상 텍스트 반환
return DocumentExtractResponse(extractedText=extracted_text)
```

**"Graceful Degradation(점진적 성능 저하)"이란:**

```
나쁜 설계:
  벡터 저장 실패 → 전체 API 500 에러 → 이력서 텍스트도 못 받음

좋은 설계 (Graceful Degradation):
  벡터 저장 실패 → 경고 로그만 → 텍스트는 정상 반환
  → 면접은 RAG 없이 계속 진행 가능
  → 사용자는 기능 저하를 느끼지만 완전 차단은 없음
```

---

## E. interview_service.py — RAG를 면접 질문에 적용

**파일 위치:** `ai-server/services/interview_service.py`

### E-1. _build_rag_context() 함수

```python
async def _build_rag_context(session_id: Optional[str], query: str) -> str:
    if not session_id:
        return "(없음)"  # sessionId 없으면 RAG 건너뜀

    chunks = await search_similar(session_id, query, n_results=3)

    if not chunks:
        return "(없음)"  # 저장된 문서 없으면 "(없음)"

    # 각 청크에 번호를 붙여서 GPT가 구분하기 쉽게 포맷팅
    return "\n\n".join(f"[관련 청크 {i + 1}]\n{chunk}" for i, chunk in enumerate(chunks))
```

**반환값 예시:**

```
"[관련 청크 1]
저는 Java 개발자로 3년간 스타트업에서 근무했습니다. Spring Boot를 사용하여...

[관련 청크 2]
REST API 설계 경험이 있으며, OpenAPI 명세를 작성하고...

[관련 청크 3]
AWS EC2와 S3를 활용하여 서비스를 배포하고 운영했습니다..."
```

### E-2. generate_interview_question() 수정

```python
async def generate_interview_question(
    resume_content: str | None,
    cover_letter_content: str | None,
    job_description: str | None,
    conversation_history: List[ConversationTurn],
    question_type: str | None = None,
    session_id: str | None = None,  # ← 새로 추가된 파라미터
) -> InterviewQuestionResponse:

    # RAG 검색 쿼리 구성
    # 이력서 + 직무 설명을 합쳐서 "가장 관련 있는 문서 부분"을 찾음
    rag_query = " ".join(filter(None, [resume_content, job_description]))
    rag_context = await _build_rag_context(session_id, rag_query or "면접 질문")

    # 프롬프트 템플릿에 rag_context 주입
    human_prompt = human_template.format(
        question_type=resolved_type,
        resume_content=resume_content or "(없음)",
        cover_letter_content=cover_letter_content or "(없음)",
        job_description=job_description or "(없음)",
        conversation_history=_format_history(conversation_history),
        rag_context=rag_context,  # ← 새로 추가
    )
```

### E-3. 프롬프트 템플릿 (interview_question_human.txt)

```
[질문 유형]: {question_type}

[이력서]:
{resume_content}

[자기소개서]:
{cover_letter_content}

[채용공고]:
{job_description}

[이전 대화 기록]:
{conversation_history}

[참고 자료 (지원자 업로드 문서에서 검색된 관련 내용)]:
{rag_context}          ← 이 부분이 RAG로 채워짐

위 정보를 바탕으로 다음 면접 질문 하나를 생성하세요.
```

**RAG 적용 전후 비교:**

```
RAG 없을 때 GPT에 가는 프롬프트:
  [이력서]: (이력서 3000자 전체)
  → GPT가 "뭘 물어봐야 하지?" 고민 → 일반적인 질문 생성

RAG 있을 때 GPT에 가는 프롬프트:
  [이력서]: (이력서 3000자 전체)
  [참고 자료]:
    [관련 청크 1] "Java 개발자 3년, Spring Boot 전문"
    [관련 청크 2] "REST API 설계, OpenAPI 문서화"
  → GPT가 핵심 내용을 정확히 파악 → "Spring Boot에서 Bean의 생명주기를 설명해주세요" 같은 깊은 질문 생성
```

---

## F. 백엔드 Java — sessionId 전달 경로

RAG가 동작하려면 Java 백엔드가 Python에 `sessionId`를 넘겨야 합니다.

```
사용자 → 브라우저 → Spring Boot → Python AI 서버
                      (InterviewService)  (interview_service.py)
```

### F-1. AiService 인터페이스

```java
// 인터페이스에 sessionId 파라미터 추가
String generateInterviewQuestion(
    String resumeContent,
    String coverLetterContent,
    String jobDescription,
    String history,
    String questionType,
    String sessionId    // ← 새로 추가
);
```

### F-2. PythonAiService — 실제 Python 호출

```java
// Python 서버에 전달할 요청 DTO (내부 record)
private record InterviewQuestionRequest(
    String resumeContent,
    String coverLetterContent,
    String jobDescription,
    List<ConversationTurnDto> conversationHistory,
    String questionType,
    String sessionId    // ← Python schema의 sessionId와 동일 이름
) {}

@Override
public String generateInterviewQuestion(..., String sessionId) {
    InterviewQuestionRequest request = new InterviewQuestionRequest(
        resumeContent, coverLetterContent, jobDescription,
        parseHistoryToTurns(history), questionType,
        sessionId    // ← 전달
    );

    InterviewQuestionResponse response = post(url, request, InterviewQuestionResponse.class);
    return response.question();
}
```

**Java record가 JSON으로 직렬화되면:**

```json
{
  "resumeContent": "...",
  "coverLetterContent": "...",
  "jobDescription": "...",
  "conversationHistory": [],
  "questionType": "INITIAL",
  "sessionId": "42"    ← Python에서 body.sessionId로 읽힘
}
```

### F-3. InterviewService — 세션 ID 전달

```java
@Transactional
public SessionStartResponseDto startSession(String email, SessionStartRequestDto request) {
    // ... 세션 생성 ...
    interviewRepository.save(session);  // session.getId()가 42가 됨

    String firstQuestion = aiService.generateInterviewQuestion(
        resumeContent, coverLetterContent, jobDescription,
        "", request.questionType(),
        session.getId().toString()  // ← "42" 문자열로 변환해서 전달
    );
}

@Transactional
public AnswerResponseDto submitAnswer(Long sessionId, ...) {
    // ...
    String nextQuestion = aiService.generateInterviewQuestion(
        resumeContent, coverLetterContent, jobDescription,
        history, session.getQuestionType(),
        sessionId.toString()  // ← 답변 제출 시에도 같은 세션 ID 사용
    );
}
```

---

## G. docker-compose.yml — ChromaDB 컨테이너

```yaml
# 추가된 ChromaDB 서비스
chromadb:
  image: chromadb/chroma:latest      # 공식 ChromaDB 이미지
  container_name: ai-interview-chroma
  restart: unless-stopped            # 크래시 시 자동 재시작
  ports:
    - "8001:8000"                    # 호스트 8001 → 컨테이너 내부 8000
    # ↑ ChromaDB 기본 포트가 8000이지만
    # ↑ 우리 ai-server도 8000을 쓰므로 외부 포트를 8001로 변경
  volumes:
    - chroma_data:/chroma/chroma     # 데이터 영구 저장
    # ↑ 컨테이너 재시작해도 데이터 유지
  environment:
    ANONYMIZED_TELEMETRY: "false"    # ChromaDB 사용 데이터 전송 비활성화
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:8000/api/v1/heartbeat"]
    # ↑ ChromaDB가 준비됐는지 확인하는 명령어

# ai-server에서 ChromaDB에 접근하는 환경변수
ai-server:
  environment:
    CHROMA_HOST: chromadb            # Docker 내부 네트워크에서 컨테이너명으로 접근
    CHROMA_PORT: 8000                # 컨테이너 내부 포트 (외부 8001이 아님)
    # ↑ Docker 내부 통신은 외부 포트 말고 내부 포트 사용
  depends_on:
    chromadb:
      condition: service_healthy     # ChromaDB 준비 후에만 ai-server 시작
```

**Docker 내부 네트워크 포트 이해:**

```
외부 (개발자 브라우저):
  localhost:8001 → ChromaDB 접근 (테스트용)

Docker 내부 컨테이너 간:
  ai-server 컨테이너 → chromadb:8000 (컨테이너명:내부포트)
  ↑ 같은 Docker 네트워크 안에서는 컨테이너명이 도메인처럼 동작
```

---

## H. 전체 데이터 흐름 시나리오

**시나리오: 사용자가 이력서 업로드 후 면접 시작**

### 1단계: 면접 세션 시작

```
사용자 → POST /api/interviews/sessions (Spring Boot 8080)
       Body: { resumeId: 1, questionType: "INITIAL" }

Spring Boot:
  1. InterviewSessionEntity 생성 → id=42 부여
  2. 이력서 내용 DB에서 조회 (resume.content)
  3. Python POST /interview/question
     { sessionId: "42", resumeContent: "..." }

Python:
  1. session_id="42" → search_similar("42", query)
  2. 컬렉션 "session_42" 조회 → 비어 있음 (문서 미업로드)
  3. rag_context = "(없음)"
  4. 프롬프트에 "(없음)" 주입 → GPT 호출
  5. 일반적인 첫 질문 반환: "자기소개를 해주세요."
```

### 2단계: 이력서 PDF 업로드 (면접 중 추가 가능)

```
사용자 → POST /extract/document (Python 8000)
       FormData: { file: 이력서.pdf, session_id: "42" }

Python:
  1. PDF에서 텍스트 추출
  2. chunk_text() → 청크 6개 생성 (3000자 이력서 기준)
  3. embed_texts() → OpenAI API → 6개 벡터 생성
  4. ChromaDB "session_42" 컬렉션에 6개 청크 저장
  5. { extractedText: "..." } 반환
```

### 3단계: 답변 제출 후 다음 질문 생성 (RAG 활성화)

```
사용자 → POST /api/interviews/sessions/42/answer (Spring Boot 8080)
       Body: { orderNum: 1, answerText: "저는 Java 개발자입니다..." }

Spring Boot:
  1. 답변 저장
  2. Python POST /interview/question
     { sessionId: "42", questionType: "FOLLOWUP", ... }

Python:
  1. session_id="42" → search_similar("42", "이력서 내용...")
  2. 컬렉션 "session_42" 조회 → 6개 청크 있음!
  3. 코사인 유사도 계산 → 관련 청크 3개 선택
  4. rag_context = "[관련 청크 1]\nJava 개발 3년...\n\n[관련 청크 2]..."
  5. 프롬프트에 주입 → GPT 호출
  6. 개인화된 질문 반환: "이력서에 보면 Spring Boot를 3년 사용하셨는데,
     트랜잭션 처리에서 어려웠던 경험을 말씀해주세요."
```

---

## I. 개발 환경 설정 방법

### ChromaDB 없이 로컬 테스트 (EphemeralClient 폴백)

```bash
# CHROMA_HOST 환경변수 없이 ai-server 실행
cd ai-server
python main.py

# → CHROMA_HOST 없음 감지 → EphemeralClient 사용
# → 메모리에 벡터 저장 (재시작 시 사라짐)
# → RAG 기능 동작 확인 가능
```

### Docker로 ChromaDB 실행

```bash
# ChromaDB만 별도 실행
docker-compose up chromadb -d

# 실행 확인
curl http://localhost:8001/api/v1/heartbeat
# 응답: {"nanosecond heartbeat": 1234567890123456789}

# 환경변수 설정 후 ai-server 실행
export CHROMA_HOST=localhost
export CHROMA_PORT=8001
python main.py
```

### 전체 Docker Compose 실행

```bash
# 모든 서비스 한 번에 실행
docker-compose up -d

# ChromaDB 먼저 healthy 되면 ai-server 자동 시작
# (depends_on: condition: service_healthy)

# 서비스 상태 확인
docker-compose ps
```

---

## J. 자주 발생하는 오류와 해결법

| 오류 | 원인 | 해결 |
|------|------|------|
| `chromadb.errors.InvalidCollectionException` | 컬렉션명에 특수문자 | session_id를 숫자만 사용 |
| `n_results can't be greater than number of elements` | 저장된 청크보다 더 많이 요청 | `min(n_results, collection.count())` 적용 |
| `Connection refused localhost:8001` | ChromaDB 컨테이너 미실행 | `docker-compose up chromadb -d` |
| `OPENAI_API_KEY not set` | 환경변수 누락 | `.env` 파일에 키 추가 |
| `EphemeralClient` 사용 시 데이터 없음 | 재시작 시 메모리 초기화 | 운영환경에서는 Docker + HttpClient 사용 |

---

## K. 요약 — 핵심 개념 3줄로

```
1. 임베딩(Embedding): 텍스트를 1536개 숫자(벡터)로 변환하여 의미를 수학적으로 표현
2. ChromaDB: 벡터를 저장하고 "비슷한 의미의 텍스트"를 빠르게 찾아주는 데이터베이스
3. RAG: 문서 전체 대신 "지금 질문과 관련된 부분만" 골라서 GPT에 전달 → 더 정확한 답변
```

---

## 전체 요약

| 기능 | 핵심 개념 | 필요한 키 | 비용 |
|------|-----------|-----------|------|
| 카카오 OAuth | Authorization Code Flow | REST API 키, JS 키 | 무료 |
| PortOne 결제 | 서버사이드 금액 검증 | 스토어ID, 채널키, 시크릿키 | 거래당 수수료 |
| Vector DB + RAG | 임베딩 + 유사도 검색 | OpenAI API 키 | 임베딩 비용 극소 |

---

## 체크리스트

### 카카오 OAuth 적용 전 확인
- [ ] https://developers.kakao.com 앱 등록 완료
- [ ] Redirect URI에 `http://localhost:5173/auth/kakao/callback` 추가
- [ ] 동의 항목 → 이메일 "필수 동의" 설정
- [ ] `.env`에 `KAKAO_CLIENT_ID` 입력
- [ ] `.env.local`에 `VITE_KAKAO_JS_KEY` 입력

### PortOne 결제 적용 전 확인
- [ ] https://admin.portone.io 계정 등록
- [ ] 테스트 환경 채널 등록 (카카오페이)
- [ ] `.env`에 `PORTONE_SECRET_KEY` 입력 (절대 프론트에 X)
- [ ] `.env.local`에 `VITE_PORTONE_STORE_ID`, `VITE_PORTONE_CHANNEL_KEY` 입력

### Vector DB + RAG 적용 전 확인
- [ ] Docker Desktop 설치 + 실행 중
- [ ] `docker-compose up chromadb -d` 실행
- [ ] `pip install chromadb` 완료
- [ ] OpenAI API 키 설정 (기존 면접 기능과 공유 가능)
