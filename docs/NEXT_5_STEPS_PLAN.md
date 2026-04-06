# AI Interview Mentor — 다음 5단계 실행 계획 + 프롬프트

> 각 단계별로 **목표 → 구현 범위 → 예상 파일 → 실행 프롬프트**를 정리합니다.
> 프롬프트를 Claude Code에 붙여넣기하면 해당 기능을 구현할 수 있습니다.

---

## 1단계: 카카오 OAuth 백엔드 구현

### 목표
카카오 로그인 버튼 클릭 → 인가 코드 → JWT 발급까지 전체 소셜 로그인 파이프라인 완성

### 구현 범위
- `KakaoOAuthService`: code → access_token 교환, 사용자 정보 조회
- `AuthController`: `POST /api/auth/kakao` 엔드포인트 추가
- `AuthService`: 카카오 사용자 자동 가입/로그인 + JWT 발급
- `application.yml`: 카카오 API 키 환경 변수 바인딩
- `SecurityConfig`: `/api/auth/kakao` permitAll 추가

### 예상 변경 파일
```
backend/.../domain/user/KakaoOAuthService.java (신규)
backend/.../domain/user/dto/KakaoTokenResponseDto.java (신규)
backend/.../domain/user/dto/KakaoUserInfoDto.java (신규)
backend/.../domain/user/AuthController.java (수정)
backend/.../domain/user/AuthService.java (수정)
backend/.../config/SecurityConfig.java (수정)
backend/.../src/main/resources/application-dev.yaml (수정)
```

### 실행 프롬프트
```
다음 작업을 수행해줘:

1. 카카오 OAuth 로그인 백엔드를 구현해줘.
2. AGENTS.md 규칙을 따르고, 각 클래스/메서드에 한국어 주석을 달아줘.

[구현 상세]
- KakaoOAuthService 신규 생성 (com.aimentor.domain.user 패키지)
  - getAccessToken(code): 카카오 토큰 API에 code를 보내 access_token을 받음
  - getUserInfo(accessToken): 카카오 사용자 정보 API에서 이메일/닉네임 조회
- KakaoTokenResponseDto, KakaoUserInfoDto 신규 생성
- AuthController에 POST /api/auth/kakao 엔드포인트 추가
  - 요청: { code: "인가코드" }
  - 응답: { accessToken, refreshToken, user } (기존 로그인 응답과 동일)
- AuthService에 kakaoLogin(code) 메서드 추가
  - 카카오에서 받은 이메일로 기존 회원 조회 → 없으면 자동 가입(provider: "KAKAO")
  - JWT accessToken + refreshToken 발급
- application-dev.yaml에 kakao 설정 추가 (환경변수 바인딩)
- SecurityConfig에 /api/auth/kakao permitAll 추가
- 프론트엔드 LoginPage.jsx의 카카오 콜백 처리와 연동되는지 확인

[검증]
- 작업 후 변경된 파일, 검증 방법, 남은 위험 요소, 다음 추천 작업을 정리해줘.
```

---

## 2단계: PortOne 결제 SDK 연동

### 목표
카카오페이 결제 승인 흐름을 실제 PG사(PortOne)와 연동하여 결제 → 검증 → 주문 확정 파이프라인 완성

### 구현 범위
- 프론트: PortOne SDK `@portone/browser-sdk` 설치 + 결제 요청 호출
- 백엔드: PortOne 결제 검증 API (`/api/orders/{id}/verify-payment`)
- 주문 상태 PENDING → PAID 전환을 PG 검증 결과 기반으로 처리

### 예상 변경 파일
```
frontend/package.json (@portone/browser-sdk 추가)
frontend/src/pages/bookstore/CheckoutPage.jsx (수정 - PG 결제 호출)
frontend/src/api/order.js (수정 - 검증 API 호출 추가)
backend/.../external/payment/PortOneService.java (신규)
backend/.../external/payment/dto/PortOneVerifyResponseDto.java (신규)
backend/.../domain/book/OrderController.java (수정 - 검증 엔드포인트)
backend/.../domain/book/OrderService.java (수정 - 검증 로직)
backend/.../config/SecurityConfig.java (수정)
```

### 실행 프롬프트
```
다음 작업을 수행해줘:

1. PortOne(구 아임포트) 결제 SDK를 연동해줘.
2. AGENTS.md 규칙을 따르고, 각 클래스/메서드에 한국어 주석을 달아줘.

[프론트엔드]
- @portone/browser-sdk 설치
- CheckoutPage.jsx에서 결제 버튼 클릭 시:
  1. 주문 생성 API 호출 → orderId 받기
  2. PortOne SDK requestPayment() 호출 (카카오페이)
  3. PG 결제 완료 후 impUid(결제 고유번호)를 받아서
  4. POST /api/orders/{orderId}/verify-payment { impUid } 호출
  5. 검증 성공 시 주문 완료 페이지로 이동

[백엔드]
- PortOneService 신규 생성 (com.aimentor.external.payment 패키지)
  - verifyPayment(impUid): PortOne REST API로 결제 금액/상태 검증
  - getAccessToken(): PortOne API 인증 토큰 발급
- OrderController에 POST /api/orders/{id}/verify-payment 추가
- OrderService에 verifyAndConfirmPayment(orderId, impUid) 추가
  - PortOne에서 실제 결제 금액 조회 → 주문 totalPrice와 비교
  - 금액 일치하면 PAID, 불일치하면 PAYMENT_FAILED로 변경
- application-dev.yaml에 portone.api-key, portone.api-secret 환경변수 추가
- SecurityConfig에 해당 엔드포인트 인증 필요로 설정

[주의사항]
- 테스트 환경에서는 PortOne 테스트 키 사용
- 결제 금액 위변조 방지를 위해 반드시 서버사이드 검증 수행
- 검증 실패 시 자동 환불 처리 로직 포함

[검증]
- 작업 후 변경된 파일, 검증 방법, 남은 위험 요소, 다음 추천 작업을 정리해줘.
```

---

## 3단계: Vector DB + RAG 구현

### 목표
이력서/자소서/채용공고를 벡터 DB에 임베딩 저장하고, 면접 질문 생성 시 RAG로 관련 문맥을 주입하여 질문 품질 향상

### 구현 범위
- ChromaDB 또는 Pinecone 로컬 인스턴스 설정
- 문서 업로드 시 자동 임베딩 + 벡터 저장
- 면접 질문 생성 시 유사도 검색으로 관련 문서 청크 추출
- GPT 프롬프트에 검색 결과 주입 (RAG 패턴)

### 예상 변경 파일
```
ai-server/services/vector_service.py (신규)
ai-server/services/embedding_service.py (신규)
ai-server/services/interview_service.py (수정 - RAG 주입)
ai-server/routers/document.py (수정 - 업로드 시 임베딩)
docker-compose.yml (수정 - ChromaDB 컨테이너 추가)
requirements.txt (수정 - chromadb, langchain 추가)
```

### 실행 프롬프트
```
다음 작업을 수행해줘:

1. Vector DB(ChromaDB) + RAG 파이프라인을 구현해줘.
2. AGENTS.md 규칙을 따르고, 각 함수에 한국어 주석을 달아줘.

[Vector DB 설정]
- docker-compose.yml에 ChromaDB 컨테이너 추가 (포트 8001)
- requirements.txt에 chromadb, langchain-chroma 추가
- ai-server/services/vector_service.py 신규 생성
  - init_collection(): 사용자별 컬렉션 생성/조회
  - upsert_document(user_id, doc_type, doc_id, text): 문서를 청크로 분할 → 임베딩 → ChromaDB 저장
  - search_similar(user_id, query, top_k=5): 유사도 검색

[임베딩 서비스]
- ai-server/services/embedding_service.py 신규 생성
  - embed_text(text): OpenAI text-embedding-3-small로 임베딩 벡터 생성
  - chunk_text(text, chunk_size=500, overlap=50): 텍스트를 겹침 있는 청크로 분할

[RAG 연동]
- document.py 라우터에서 문서 저장 성공 시 vector_service.upsert_document() 호출
- interview_service.py의 면접 질문 생성 시:
  1. 사용자의 벡터 DB에서 관련 문서 청크 검색
  2. 검색된 청크를 GPT 시스템 프롬프트에 "참고 문서" 섹션으로 주입
  3. 기존 프롬프트 구조는 유지하되 context 파라미터만 추가

[주의사항]
- 임베딩 API 호출 비용을 고려해 text-embedding-3-small 사용
- 문서 삭제 시 벡터 DB에서도 해당 문서 삭제
- ChromaDB persist 디렉토리를 docker volume으로 마운트

[검증]
- 작업 후 변경된 파일, 검증 방법, 남은 위험 요소, 다음 추천 작업을 정리해줘.
```

---

## 4단계: 주소 API 연동 (카카오 주소 검색)

### 목표
주문 시 배송지 입력을 카카오 주소 검색 API로 대체하여 정확한 도로명 주소 + 우편번호 자동 입력

### 구현 범위
- 카카오 주소 검색 팝업 연동 (Daum Postcode)
- 주문 폼에서 주소 검색 버튼 → 팝업 → 선택 → 자동 입력
- 마이페이지 기본 배송지 설정에도 동일 적용

### 예상 변경 파일
```
frontend/index.html (수정 - Daum Postcode 스크립트 추가)
frontend/src/utils/postcodeSearchProvider.js (수정 - 실제 카카오 API 연동)
frontend/src/utils/AddressSearchDialog.jsx (수정 - 팝업 UI 개선)
frontend/src/pages/bookstore/CheckoutPage.jsx (수정 - 주소 자동완성 연동)
frontend/src/pages/MyPage.jsx (수정 - 기본 배송지 설정)
```

### 실행 프롬프트
```
다음 작업을 수행해줘:

1. 카카오 Daum Postcode 주소 검색 API를 연동해줘.
2. AGENTS.md 규칙을 따르고, 각 컴포넌트에 한국어 주석을 달아줘.

[프론트엔드 구현]
- index.html <head>에 Daum Postcode 스크립트 태그 추가:
  <script src="//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js"></script>
- postcodeSearchProvider.js를 실제 daum.Postcode API 호출로 구현:
  - openPostcodeSearchProvider(callback) 함수
  - new daum.Postcode({ oncomplete: (data) => callback(data) }).open()
  - callback에 { zonecode, roadAddress, jibunAddress, buildingName } 전달
- AddressSearchDialog.jsx 개선:
  - 팝업 방식 대신 임베디드 방식 지원 (선택 가능)
  - 상세 주소 입력 필드 추가 (동/호수)
  - 선택한 주소 미리보기 표시
- CheckoutPage.jsx 주문 폼:
  - "주소 검색" 버튼 클릭 시 Daum Postcode 팝업 호출
  - 우편번호(zonecode) + 도로명 주소(roadAddress) 자동 입력
  - 상세 주소만 사용자가 직접 입력
- MyPage.jsx 프로필 섹션:
  - 기본 배송지 설정에도 동일 주소 검색 적용
  - 저장 시 백엔드 프로필 API로 주소/우편번호 전송

[주의사항]
- Daum Postcode는 무료 API이므로 별도 키 불필요
- 모바일 환경에서 팝업이 정상 동작하는지 확인
- 기존 postcodeSearchProvider.js의 인터페이스를 유지하면서 내부 구현만 교체

[검증]
- 작업 후 변경된 파일, 검증 방법, 남은 위험 요소, 다음 추천 작업을 정리해줘.
```

---

## 5단계: 결제 검증 강화 (서버사이드 검증 + Webhook)

### 목표
결제 위변조 방지를 위한 서버사이드 금액 검증 + PortOne Webhook으로 비동기 결제 상태 동기화

### 구현 범위
- PortOne Webhook 엔드포인트 구현 (결제 상태 변경 알림 수신)
- 결제 완료 시 이중 검증 (클라이언트 검증 + Webhook 검증)
- 결제 실패/취소 시 자동 재고 복구 + 주문 상태 변경

### 예상 변경 파일
```
backend/.../external/payment/PortOneWebhookController.java (신규)
backend/.../external/payment/PortOneService.java (수정 - webhook 검증)
backend/.../external/payment/dto/PortOneWebhookDto.java (신규)
backend/.../domain/book/OrderService.java (수정 - webhook 처리)
backend/.../config/SecurityConfig.java (수정 - webhook permitAll)
backend/.../domain/subscription/SubscriptionService.java (수정 - 구독 결제 검증)
```

### 실행 프롬프트
```
다음 작업을 수행해줘:

1. PortOne Webhook 기반 결제 검증 강화를 구현해줘.
2. AGENTS.md 규칙을 따르고, 각 클래스/메서드에 한국어 주석을 달아줘.

[Webhook 엔드포인트]
- PortOneWebhookController 신규 생성 (com.aimentor.external.payment 패키지)
  - POST /api/payment/webhook (permitAll — PortOne 서버에서 호출)
  - 요청 본문: { imp_uid, merchant_uid, status }
  - PortOne에서 보내는 결제 상태 변경 알림을 수신

[검증 로직]
- PortOneService에 webhook 처리 메서드 추가:
  - handleWebhook(impUid, merchantUid, status):
    1. PortOne REST API로 실제 결제 정보 조회
    2. DB의 주문(merchant_uid)과 결제 금액 비교 검증
    3. 상태에 따라 분기:
       - "paid": 주문 PAID로 변경
       - "cancelled"/"failed": 주문 CANCELLED로 변경 + 재고 복구
  - validateWebhookSignature(headers, body): 위변조 방지 서명 검증

[이중 검증 패턴]
- 클라이언트 검증 (2단계에서 구현): 사용자 결제 직후 즉시 검증
- Webhook 검증 (이번 단계): 네트워크 문제로 클라이언트 검증 누락 시 보완
- 두 경로 모두 같은 verifyAndConfirmPayment() 호출 → 멱등성 보장
  - 이미 PAID인 주문은 다시 처리하지 않음 (상태 체크)

[구독 결제 검증]
- SubscriptionService에도 동일한 검증 패턴 적용
  - 구독 결제 완료 Webhook 수신 시 ACTIVE로 전환
  - 구독 결제 실패 시 PAYMENT_FAILED로 전환

[SecurityConfig]
- /api/payment/webhook POST permitAll 추가
- Webhook은 IP 화이트리스트 또는 서명 검증으로 보안 확보

[주의사항]
- Webhook은 여러 번 호출될 수 있으므로 반드시 멱등성 보장
- merchant_uid 형식: "order_{orderId}" 또는 "sub_{subscriptionId}"로 구분
- 로컬 개발 시 ngrok 등으로 Webhook URL 외부 노출 필요

[검증]
- 작업 후 변경된 파일, 검증 방법, 남은 위험 요소, 다음 추천 작업을 정리해줘.
```

---

## 실행 순서 권장

```
1단계(카카오 OAuth) → 2단계(PortOne 결제) → 5단계(결제 검증 강화)
        ↓
3단계(Vector DB + RAG) — 면접 품질 향상, 독립적으로 진행 가능
        ↓
4단계(주소 API) — UI 개선, 가장 간단하므로 언제든 진행 가능
```

| 단계 | 난이도 | 예상 소요 | 의존성 |
|------|--------|-----------|--------|
| 1. 카카오 OAuth | 중 | - | 없음 |
| 2. PortOne 결제 | 상 | - | 없음 |
| 3. Vector DB + RAG | 상 | - | 없음 |
| 4. 주소 API | 하 | - | 없음 |
| 5. 결제 검증 강화 | 중 | - | 2단계 완료 필요 |

---

## 포트폴리오 어필 포인트

### 기술 면접에서 설명하기 좋은 구조
1. **카카오 OAuth**: OAuth 2.0 Authorization Code Flow 전체 이해 증명
2. **PortOne 결제**: PG 연동 실무 경험 + 금액 위변조 방지 패턴
3. **Vector DB + RAG**: LLM 활용 고급 패턴 (임베딩 + 유사도 검색 + 컨텍스트 주입)
4. **주소 API**: 외부 SDK 연동 + UX 개선 사례
5. **결제 검증**: Webhook + 멱등성 + 이중 검증 → 안전한 결제 아키텍처
