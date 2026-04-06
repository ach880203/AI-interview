# AI Interview Mentor — 초보자를 위한 구현 교안

> 이 문서는 다음 5가지 기능을 직접 구현할 수 있도록 단계별로 안내합니다.
> 각 섹션은 **왜 필요한지 → 어떤 흐름인지 → 코드 어디를 수정하는지** 순서로 설명합니다.

---

## 1. 카카오 OAuth 백엔드 구현

### 1.1 왜 필요한가?
현재 프론트엔드에서 카카오 로그인 버튼을 누르면 카카오 인가 서버로 이동하고,
콜백으로 `code`가 돌아옵니다. 하지만 백엔드에 `/api/auth/kakao` 엔드포인트가 없어서
실제 로그인이 완료되지 않습니다.

### 1.2 전체 흐름
```
[사용자] → 카카오 로그인 버튼 클릭
  → 카카오 인가 서버로 리다이렉트
  → 사용자가 카카오에서 동의
  → /auth/kakao/callback?code=XXXXX 로 돌아옴
  → 프론트: POST /api/auth/kakao { code: "XXXXX" }
  → 백엔드:
    1) 카카오 토큰 API 호출 (code → access_token 교환)
    2) 카카오 사용자 정보 API 호출 (access_token → 이메일, 이름)
    3) DB에 해당 이메일 사용자가 있으면 로그인, 없으면 자동 가입
    4) JWT 발급 (accessToken + refreshToken)
    5) 응답: { accessToken, refreshToken, user }
```

### 1.3 구현 단계

**Step 1: application.yml에 카카오 설정 추가**
```yaml
kakao:
  client-id: ${KAKAO_REST_API_KEY}
  client-secret: ${KAKAO_CLIENT_SECRET}  # 카카오 개발자 콘솔에서 발급
  redirect-uri: http://localhost:5173/auth/kakao/callback
  token-uri: https://kauth.kakao.com/oauth/token
  user-info-uri: https://kapi.kakao.com/v2/user/me
```

**Step 2: KakaoOAuthService 클래스 생성**
위치: `com.aimentor.domain.user.KakaoOAuthService`

```java
@Service
@RequiredArgsConstructor
public class KakaoOAuthService {

    @Value("${kakao.client-id}")
    private String clientId;

    @Value("${kakao.redirect-uri}")
    private String redirectUri;

    private final RestTemplate restTemplate = new RestTemplate();

    // 1. code → access_token 교환
    public String getAccessToken(String code) {
        MultiValueMap<String, String> params = new LinkedMultiValueMap<>();
        params.add("grant_type", "authorization_code");
        params.add("client_id", clientId);
        params.add("redirect_uri", redirectUri);
        params.add("code", code);

        ResponseEntity<Map> response = restTemplate.postForEntity(
            "https://kauth.kakao.com/oauth/token", params, Map.class);
        return (String) response.getBody().get("access_token");
    }

    // 2. access_token → 사용자 정보 조회
    public KakaoUserInfo getUserInfo(String accessToken) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(accessToken);
        HttpEntity<Void> entity = new HttpEntity<>(headers);

        ResponseEntity<Map> response = restTemplate.exchange(
            "https://kapi.kakao.com/v2/user/me",
            HttpMethod.GET, entity, Map.class);

        Map<String, Object> kakaoAccount = (Map) response.getBody().get("kakao_account");
        String email = (String) kakaoAccount.get("email");
        Map<String, Object> profile = (Map) kakaoAccount.get("profile");
        String nickname = (String) profile.get("nickname");

        return new KakaoUserInfo(email, nickname);
    }
}
```

**Step 3: AuthController에 카카오 엔드포인트 추가**
```java
@PostMapping("/kakao")
public ResponseEntity<ApiResponse<AuthResponseDto>> kakaoLogin(
        @RequestBody KakaoLoginRequestDto request) {
    // 1. code → access_token
    String accessToken = kakaoOAuthService.getAccessToken(request.code());
    // 2. 사용자 정보 조회
    KakaoUserInfo userInfo = kakaoOAuthService.getUserInfo(accessToken);
    // 3. DB 조회 또는 자동 가입
    UserEntity user = userRepository.findByEmail(userInfo.email())
        .orElseGet(() -> createKakaoUser(userInfo));
    // 4. JWT 발급
    String jwt = jwtTokenProvider.generateToken(user.getEmail());
    String refresh = jwtTokenProvider.generateRefreshToken(user.getEmail());
    // 5. 응답
    return ResponseEntity.ok(ApiResponse.success(new AuthResponseDto(jwt, refresh, user)));
}
```

**Step 4: SecurityConfig에 permitAll 추가**
```java
.requestMatchers("/api/auth/kakao").permitAll()
```

### 1.4 테스트 방법
1. 카카오 개발자 콘솔에서 앱 등록 및 Redirect URI 설정
2. `.env`에 `KAKAO_REST_API_KEY`, `KAKAO_CLIENT_SECRET` 설정
3. 프론트에서 카카오 로그인 버튼 클릭 → 카카오 동의 → 대시보드 이동 확인

---

## 2. PortOne(아임포트) 결제 SDK 연동

### 2.1 왜 필요한가?
현재 결제는 클라이언트가 직접 "APPROVED"를 보내는 Mock 방식입니다.
실제 돈을 받으려면 PG사(PortOne) SDK를 연동해야 합니다.

### 2.2 전체 흐름
```
[사용자] → 결제하기 클릭
  → 프론트: PortOne SDK로 결제창 오픈
  → 사용자가 카카오페이/토스 등으로 결제
  → PortOne이 결제 결과를 프론트에 전달 (imp_uid, merchant_uid)
  → 프론트: POST /api/orders/{orderId}/payment { impUid, merchantUid }
  → 백엔드:
    1) PortOne API로 imp_uid 검증 (실제 결제됐는지 확인)
    2) 결제 금액 == 주문 금액 일치 확인
    3) 일치하면 주문 상태를 PAID로 변경
    4) 불일치하면 자동 환불 처리
```

### 2.3 구현 단계

**Step 1: 프론트에 PortOne SDK 설치**
```html
<!-- index.html -->
<script src="https://cdn.iamport.kr/v1/iamport.js"></script>
```
또는 V2 SDK:
```bash
npm install @portone/browser-sdk
```

**Step 2: 프론트에서 결제 요청**
```javascript
import * as PortOne from "@portone/browser-sdk/v2";

async function handlePayment(order) {
  const response = await PortOne.requestPayment({
    storeId: import.meta.env.VITE_PORTONE_STORE_ID,
    channelKey: import.meta.env.VITE_CHANNEL_KEY_KAKAOPAY,
    paymentId: `order_${order.id}_${Date.now()}`,
    orderName: `AI멘토 도서 주문 #${order.id}`,
    totalAmount: order.totalPrice,
    currency: "CURRENCY_KRW",
    payMethod: "EASY_PAY",
  });

  if (response.code) {
    alert("결제 실패: " + response.message);
    return;
  }

  // 백엔드에 결제 검증 요청
  await api.post(`/api/orders/${order.id}/verify-payment`, {
    paymentId: response.paymentId,
  });
}
```

**Step 3: 백엔드에서 결제 검증**
```java
@PostMapping("/{orderId}/verify-payment")
public ResponseEntity<ApiResponse<OrderResponseDto>> verifyPayment(
    @PathVariable Long orderId,
    @RequestBody PaymentVerifyRequestDto request) {

    // 1. PortOne API로 실제 결제 정보 조회
    // GET https://api.portone.io/payments/{paymentId}
    // Authorization: PortOne {API_SECRET}

    // 2. 금액 비교
    // 3. 상태 업데이트
}
```

**Step 4: PortOne REST API로 결제 조회**
```java
HttpHeaders headers = new HttpHeaders();
headers.set("Authorization", "PortOne " + portoneApiSecret);
// GET https://api.portone.io/payments/{paymentId}
```

### 2.4 주의사항
- **절대로** 클라이언트가 보낸 금액을 신뢰하지 마세요
- 반드시 PortOne API로 실제 결제된 금액을 확인해야 합니다
- 금액 불일치 시 자동 환불 처리 로직이 필요합니다

---

## 3. 벡터 DB (RAG) 구현

### 3.1 왜 필요한가?
현재 면접 질문 생성 시 이력서/자소서 전문을 GPT 프롬프트에 그대로 넣습니다.
문서가 길어지면 토큰 비용이 급증하고, 컨텍스트 윈도우를 초과할 수 있습니다.
RAG(Retrieval-Augmented Generation)로 관련 부분만 검색해서 넣으면 비용과 품질 모두 개선됩니다.

### 3.2 전체 흐름
```
[문서 업로드 시]
  이력서/자소서 텍스트 → 청크 분할 (500자 단위)
  → OpenAI text-embedding-3-small로 임베딩 생성
  → ChromaDB/pgvector에 벡터 저장

[면접 질문 생성 시]
  질문 생성 요청 → 질문 주제를 임베딩
  → 벡터 DB에서 유사 청크 Top 5 검색
  → 검색된 청크만 프롬프트에 포함
  → GPT가 맞춤 질문 생성
```

### 3.3 구현 단계

**Step 1: ChromaDB 설치 (ai-server)**
```bash
pip install chromadb
```

**Step 2: 문서 임베딩 저장 서비스**
```python
# ai-server/services/vector_store.py
import chromadb
from openai import OpenAI

client = OpenAI()
chroma_client = chromadb.PersistentClient(path="./chroma_data")
collection = chroma_client.get_or_create_collection("documents")

def embed_and_store(user_id: int, doc_type: str, text: str):
    # 1. 텍스트를 500자 청크로 분할
    chunks = [text[i:i+500] for i in range(0, len(text), 400)]  # 100자 오버랩

    # 2. 임베딩 생성
    response = client.embeddings.create(
        model="text-embedding-3-small",
        input=chunks
    )

    # 3. ChromaDB에 저장
    ids = [f"{user_id}_{doc_type}_{i}" for i in range(len(chunks))]
    embeddings = [item.embedding for item in response.data]

    collection.upsert(
        ids=ids,
        embeddings=embeddings,
        documents=chunks,
        metadatas=[{"user_id": user_id, "doc_type": doc_type}] * len(chunks)
    )
```

**Step 3: 유사 청크 검색**
```python
def search_relevant_chunks(user_id: int, query: str, top_k: int = 5):
    query_embedding = client.embeddings.create(
        model="text-embedding-3-small",
        input=[query]
    ).data[0].embedding

    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=top_k,
        where={"user_id": user_id}
    )

    return results["documents"][0]  # 관련 청크 리스트
```

**Step 4: 면접 질문 프롬프트에 적용**
```python
# 기존: 전체 이력서를 프롬프트에 넣음
# 변경: 관련 청크만 넣음
relevant_chunks = search_relevant_chunks(user_id, f"{company} {position}")
context = "\n---\n".join(relevant_chunks)
prompt = f"다음 이력서 발췌를 참고하여 면접 질문을 생성하세요:\n{context}"
```

### 3.4 대안: pgvector
PostgreSQL/MariaDB 대신 PostgreSQL + pgvector 확장을 쓰면
별도 벡터 DB 없이 기존 DB에 벡터를 저장할 수 있습니다.

---

## 4. 다음 우편번호(주소) API 연동

### 4.1 왜 필요한가?
주문 시 배송 주소 입력이 필요합니다. 다음(카카오) 우편번호 API는
무료이고 팝업 형태로 바로 사용할 수 있습니다.

### 4.2 구현 단계

**Step 1: 스크립트 추가**
```html
<!-- index.html에 이미 추가되어 있을 수 있음 -->
<script src="//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js"></script>
```

**Step 2: 주소 검색 유틸리티**
```javascript
// utils/postcodeSearchProvider.js (이미 프로젝트에 존재)
export function openPostcodeSearch(onComplete) {
  new window.daum.Postcode({
    oncomplete: (data) => {
      onComplete({
        postalCode: data.zonecode,        // 우편번호
        roadAddress: data.roadAddress,     // 도로명 주소
        jibunAddress: data.jibunAddress,   // 지번 주소
        buildingName: data.buildingName,   // 건물명
      });
    },
  }).open();
}
```

**Step 3: 주문 폼에서 사용**
```jsx
<button onClick={() => openPostcodeSearch((addr) => {
  setAddress(addr);
})}>
  주소 검색
</button>
<input value={address.roadAddress} readOnly />
<input
  placeholder="상세 주소를 입력하세요"
  value={detailAddress}
  onChange={(e) => setDetailAddress(e.target.value)}
/>
```

### 4.3 참고
- 이 프로젝트에는 이미 `openPostcodeSearchProvider.js`와 `AddressSearchDialog.jsx`가 있습니다
- `VITE_JUSO_API_KEY`는 행정안전부 주소 API용이고, 다음 우편번호 API는 별도 키 불필요

---

## 5. 결제 검증 API 구현 (서버 사이드)

### 5.1 왜 필요한가?
현재 가장 치명적인 보안 취약점입니다.
클라이언트가 "결제 성공"이라고 보내면 서버가 그대로 믿고 주문을 승인합니다.
악의적 사용자가 개발자 도구로 요청을 조작하면 무료로 물건을 받을 수 있습니다.

### 5.2 현재 문제 코드
```java
// 현재: 클라이언트가 보낸 status를 그대로 신뢰
if ("APPROVED".equals(request.status())) {
    order.approve();  // 위험!
}
```

### 5.3 수정 방향
```java
// 수정: PortOne API로 실제 결제 확인
@Transactional
public OrderResponseDto verifyAndApprovePayment(Long orderId, String paymentId) {
    OrderEntity order = findOrder(orderId);

    // 1. PortOne REST API 호출
    PortOnePayment payment = portOneClient.getPayment(paymentId);

    // 2. 결제 상태 확인
    if (!"PAID".equals(payment.status())) {
        throw new BusinessException(ErrorCode.PAYMENT_NOT_COMPLETED);
    }

    // 3. 금액 일치 확인
    if (payment.amount() != order.getTotalPrice()) {
        // 금액 불일치 → 자동 환불
        portOneClient.cancelPayment(paymentId, "금액 불일치");
        throw new BusinessException(ErrorCode.PAYMENT_AMOUNT_MISMATCH);
    }

    // 4. 모든 검증 통과 → 주문 승인
    order.approve();
    order.setPaymentId(paymentId);
    return OrderResponseDto.from(order);
}
```

### 5.4 PortOne REST API 클라이언트
```java
@Component
public class PortOneClient {
    @Value("${portone.api-secret}")
    private String apiSecret;

    private final RestTemplate restTemplate = new RestTemplate();

    public PortOnePayment getPayment(String paymentId) {
        HttpHeaders headers = new HttpHeaders();
        headers.set("Authorization", "PortOne " + apiSecret);

        ResponseEntity<PortOnePayment> response = restTemplate.exchange(
            "https://api.portone.io/payments/" + paymentId,
            HttpMethod.GET,
            new HttpEntity<>(headers),
            PortOnePayment.class
        );

        return response.getBody();
    }
}
```

### 5.5 핵심 원칙
1. **클라이언트를 절대 신뢰하지 않는다** — 모든 결제 정보는 PG사 API로 재확인
2. **금액을 반드시 비교한다** — DB의 주문 금액과 실제 결제 금액이 다르면 즉시 환불
3. **결제 ID를 저장한다** — 추후 환불/분쟁 시 증거로 필요

---

## 부록: 각 기능의 관련 파일 위치

| 기능 | 프론트엔드 | 백엔드 | AI 서버 |
|------|-----------|--------|---------|
| 카카오 OAuth | `LoginPage.jsx`, `KakaoCallbackPage.jsx` | `AuthController`, `UserService` | - |
| PortOne 결제 | `OrderPaymentPage.jsx`, `.env` | `OrderController`, `OrderService` | - |
| 벡터 DB (RAG) | - | - | `services/interview.py`, `prompts/` |
| 주소 검색 | `AddressSearchDialog.jsx`, `postcodeSearchProvider.js` | `OrderEntity` (address 필드) | - |
| 결제 검증 | `OrderPaymentCallbackPage.jsx` | `OrderService`, `OrderController` | - |
