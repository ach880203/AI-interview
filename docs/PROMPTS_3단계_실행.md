# 3단계 실행 프롬프트

> 각 프롬프트를 Claude Code에 붙여넣으면 해당 단계를 자동으로 구현합니다.
> 권장 순서: 1단계 → 3단계 → 2단계

---

## 1단계 프롬프트 — RAG 프론트엔드 연결

```
ai-server/services/interview_service.py의 generate_interview_question() 함수를 수정해서
RAG가 실제로 동작하도록 연결해줘.

## 현재 문제
Spring Boot가 sessionId, resumeContent, coverLetterContent, jobDescription을
모두 ai-server에 전달하고 있지만, 아무도 ChromaDB에 문서를 저장하지 않아서
_build_rag_context()가 항상 "(없음)"을 반환하고 있어.

## 해야 할 일
generate_interview_question() 함수 시작 부분에,
첫 번째 질문일 때(conversation_history가 비어있을 때) 문서를 자동으로 벡터화하는 로직을 추가해줘.

구체적으로:
1. session_id가 있고 conversation_history가 비어있으면 (= 첫 질문)
2. resume_content가 있으면 → upsert_document(session_id, "resume", resume_content)
3. cover_letter_content가 있으면 → upsert_document(session_id, "cover_letter", cover_letter_content)
4. job_description이 있으면 → upsert_document(session_id, "job_description", job_description)
5. 벡터화 실패해도 면접 진행은 계속되어야 함 (try/except로 감싸기)

## 참고
- upsert_document는 services/vector_service.py에 이미 구현되어 있음
- 기존 코드의 RAG 검색 로직(_build_rag_context)은 수정하지 말 것
- import는 함수 상단이나 파일 상단에 추가
```

---

## 3단계 프롬프트 — 세션 종료 시 ChromaDB 컬렉션 정리

```
면접 세션이 종료될 때 ChromaDB의 벡터 컬렉션을 자동으로 삭제하도록 구현해줘.

## 현재 문제
면접이 끝나도 ChromaDB에 session_{id} 컬렉션이 계속 남아서 스토리지가 쌓이고 있어.

## 해야 할 일 (3개 파일 수정)

### 1) ai-server/routers/document.py — DELETE 엔드포인트 추가
- DELETE /extract/vector/{session_id} 엔드포인트를 추가
- services/vector_service.py의 delete_session_collection()을 호출
- 응답은 {"message": "session_{session_id} 컬렉션 삭제 완료"} 형태

### 2) backend/.../external/ai/PythonAiService.java — 삭제 메서드 추가
- deleteVectorCollection(String sessionId) 메서드를 추가
- ai-server의 DELETE /extract/vector/{sessionId}를 호출
- 실패해도 예외를 던지지 않고 log.warn만 남김 (면접 종료 차단 방지)

### 3) backend/.../domain/interview/InterviewService.java — 종료 시 호출
- endSession() 메서드 끝에 aiService.deleteVectorCollection(session.getId().toString()) 호출 추가
- 피드백 생성 요청 이후에 배치

## 참고
- vector_service.py의 delete_session_collection()은 이미 구현되어 있음
- PythonAiService에서 RestTemplate 사용 패턴은 기존 메서드 참고
- AiService 인터페이스가 있다면 거기에도 메서드 시그니처 추가
```

---

## 2단계 프롬프트 — 구독 결제 PortOne 연동

```
구독 결제에 PortOne SDK를 연동해줘.
서점 주문(OrderPaymentPage.jsx)에 이미 PortOne이 연결되어 있으니 같은 패턴으로 구현하면 돼.

## 현재 문제
SubscriptionPaymentPage.jsx에서 구독 결제 시 모의 콜백 화면으로 이동하고 있어.
실제 카카오페이 결제창이 뜨지 않음.

## 해야 할 일 (4개 파일 수정)

### 1) frontend/src/api/subscription.js — 검증 API 추가
- verifySubscriptionPayment(subscriptionId, body) 함수 추가
- POST /api/subscriptions/${subscriptionId}/verify-payment 호출

### 2) frontend/src/pages/subscription/SubscriptionPaymentPage.jsx — PortOne 연동
OrderPaymentPage.jsx의 패턴을 그대로 따라서:
- import * as PortOne from '@portone/browser-sdk/v2'
- VITE_PORTONE_STORE_ID, VITE_PORTONE_CHANNEL_KEY 환경변수 읽기
- 기존 handleCreatePendingSubscription()을 handleStartPayment()로 교체
- PORTONE_STORE_ID가 설정되어 있으면 → handlePortOnePayment() 호출
- 설정 안 되어 있으면 → 기존 모의 결제 콜백 페이지로 이동 (기존 동작 유지)
- handlePortOnePayment() 구현:
  - paymentId = `sub_${createdSubscription.id}_${Date.now()}`
  - orderName = `AI멘토 구독 — ${selectedPlan.name}`
  - totalAmount = selectedPlan.paymentAmount
  - currency, payMethod, easyPay는 OrderPaymentPage와 동일
  - 결제 성공 → verifySubscriptionPayment() 호출 → complete 페이지로 이동
  - 결제 실패/취소 → setError로 메시지 표시
  - 결제 성공 시 clearSubscriptionCheckoutDraft() 호출

### 3) backend/.../domain/subscription/SubscriptionController.java — 검증 엔드포인트
- POST /{id}/verify-payment 엔드포인트 추가
- PortOneVerifyRequestDto를 받아서 subscriptionService.verifyAndConfirmPayment() 호출
- 기존 OrderController의 verifyPayment()와 동일한 패턴

### 4) backend/.../domain/subscription/SubscriptionService.java — 검증 로직
- verifyAndConfirmPayment(Long subscriptionId, String paymentId, Long userId) 메서드 추가
- 구독 소유권 확인 (userId)
- 상태가 PENDING인지 확인
- portOneService.verifyPayment(paymentId, subscription.getPaymentAmount()) 호출
- 기존 활성 구독 만료 처리 (expireExistingActiveSubscriptions)
- 구독 활성화 (subscription.activate())

## 참고
- OrderPaymentPage.jsx (frontend/src/pages/bookstore/OrderPaymentPage.jsx)의 패턴을 복사
- OrderService.java의 verifyAndConfirmPayment()의 패턴을 복사
- PortOneService.java는 이미 구현되어 있으니 그대로 사용
- PortOneVerifyRequestDto도 이미 있음 (external/payment/dto/)
- PORTONE_SECRET_KEY가 비어있으면 PortOneService가 자동으로 검증을 건너뛰고 성공 반환 (개발 모드)
```

---

## 전체 실행 순서 (통합)

```
아래 3단계를 순서대로 구현해줘.
각 단계를 완료하면 변경된 파일 목록을 알려줘.

### 1단계: RAG 프론트엔드 연결
- ai-server/services/interview_service.py 수정
- generate_interview_question()에서 첫 질문 시 문서 자동 벡터화
- session_id가 있고 conversation_history가 비어있을 때만 실행
- upsert_document()로 이력서/자소서/채용공고를 ChromaDB에 저장
- 실패해도 면접 진행 가능하도록 try/except 처리

### 3단계: 세션 종료 시 ChromaDB 컬렉션 정리
- ai-server/routers/document.py에 DELETE /extract/vector/{session_id} 추가
- PythonAiService.java에 deleteVectorCollection() 메서드 추가
- InterviewService.java의 endSession()에서 컬렉션 삭제 호출
- 삭제 실패해도 세션 종료는 정상 완료되어야 함

### 2단계: 구독 결제 PortOne 연동
- frontend/src/api/subscription.js에 verifySubscriptionPayment() 추가
- SubscriptionPaymentPage.jsx에 PortOne SDK 연동 (OrderPaymentPage.jsx 패턴 복사)
- SubscriptionController.java에 POST /{id}/verify-payment 엔드포인트 추가
- SubscriptionService.java에 verifyAndConfirmPayment() 메서드 추가
- PORTONE_STORE_ID 없으면 기존 모의 결제 유지 (하위 호환)
```
