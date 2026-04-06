# 다음 3단계 실행 계획서

> 작성일: 2026-03-24
> 4단계(GitHub Actions CI/CD)는 추후 진행

---

## 목차

1. [1단계 — RAG 프론트엔드 연결](#1단계--rag-프론트엔드-연결)
2. [2단계 — 구독 결제 PortOne 연동](#2단계--구독-결제-portone-연동)
3. [3단계 — 세션 종료 시 ChromaDB 컬렉션 정리](#3단계--세션-종료-시-chromadb-컬렉션-정리)

---

# 1단계 — RAG 프론트엔드 연결

## 현재 상태 (AS-IS)

```
[프론트엔드]                    [ai-server]                [ChromaDB]
이력서 업로드 ──────────────→ POST /extract/document
                               (session_id = 없음)
                               → 텍스트만 추출             벡터 저장 ✗
                               ← extractedText 반환

[Spring Boot]                  [ai-server]                [ChromaDB]
면접 시작 ──────────────────→ POST /interview/question
                               sessionId 전달됨
                               → RAG 검색 시도             컬렉션 비어있음
                               → rag_context = "(없음)"    ← 빈 결과
```

**문제의 핵심:** Spring Boot 백엔드는 `sessionId`를 ai-server에 잘 전달하고 있지만,
문서 업로드(이력서/자소서/채용공고) 시점에는 `session_id`가 전달되지 않아 벡터가 저장되지 않습니다.

## 목표 상태 (TO-BE)

```
[Spring Boot]                  [ai-server]                [ChromaDB]
면접 시작(startSession)
  → 세션 생성 (id=42)
  → 이력서/자소서/채용공고 텍스트를
    ai-server에 전달
                    ──────────→ POST /interview/question
                                sessionId=42 전달
                                + resumeContent, coverLetterContent 전달
                                → 내부적으로 문서 벡터화    session_42 생성
                                → RAG 검색                 ← 유사 청크 3개
                                → rag_context 주입
                                ← 맥락 있는 질문 반환
```

## 수정이 필요한 파일과 내용

### 방법 A: ai-server `interview_service.py`에서 자동 벡터화 (권장)

현재 `generate_interview_question()`은 이미 `resume_content`, `cover_letter_content`, `job_description`, `session_id`를 모두 받고 있습니다.

**수정 포인트:** 첫 번째 질문 생성 시(history가 비어있을 때) 문서를 자동으로 벡터화

```python
# ai-server/services/interview_service.py

async def generate_interview_question(
    resume_content, cover_letter_content, job_description,
    conversation_history, question_type=None, session_id=None,
):
    # ★ 추가: 첫 질문(INITIAL)이면서 session_id가 있으면 문서를 벡터에 저장
    if session_id and not conversation_history:
        from services.vector_service import upsert_document
        if resume_content:
            await upsert_document(session_id, "resume", resume_content)
        if cover_letter_content:
            await upsert_document(session_id, "cover_letter", cover_letter_content)
        if job_description:
            await upsert_document(session_id, "job_description", job_description)

    # 이후 기존 로직 그대로 (RAG 검색 → 질문 생성)
    ...
```

### 방법 B: Spring Boot에서 문서 업로드 API 별도 호출

Spring Boot `InterviewService.java`의 `startSession()`에서 ai-server의 `/extract/document`를 호출하는 방법입니다.

```java
// 세션 생성 후
String sessionId = session.getId().toString();

// 이력서가 있으면 벡터 저장 요청
if (resume != null && resume.getContent() != null) {
    aiService.uploadDocumentForRag(sessionId, "resume", resume.getContent());
}
```

**방법 A를 권장하는 이유:**
1. 이미 `interview_service.py`가 모든 문서 텍스트를 받고 있음
2. 별도 API 호출 불필요 (네트워크 왕복 절약)
3. 프론트엔드 수정 불필요
4. 첫 질문 생성 전에 자연스럽게 벡터화 완료

## 예상 작업량

| 항목 | 파일 | 변경량 |
|------|------|--------|
| 벡터 자동 저장 로직 | `ai-server/services/interview_service.py` | +10줄 |
| 테스트 | 수동 면접 시작 → 질문 확인 | - |

---

# 2단계 — 구독 결제 PortOne 연동

## 현재 상태 (AS-IS)

```
[구독 결제 흐름 — 현재]

SubscriptionPaymentPage.jsx
  └── handleCreatePendingSubscription()
        ├── POST /api/subscriptions  (구독 생성, PENDING)
        └── navigate → SubscriptionPaymentCallbackPage.jsx
              └── 사용자가 수동으로 결과 선택 (승인/실패/취소)
                    └── PATCH /api/subscriptions/{id}/payment
                          └── navigate → SubscriptionCompletePage.jsx
```

**문제:** 카카오페이 결제창이 뜨지 않고, 사용자가 직접 "승인/실패/취소"를 선택하는 모의 화면입니다.

## 목표 상태 (TO-BE)

```
[구독 결제 흐름 — 목표]

SubscriptionPaymentPage.jsx
  └── handleStartPayment()
        ├── POST /api/subscriptions  (구독 생성, PENDING)
        │
        ├── [PortOne 설정 있음]
        │     └── PortOne.requestPayment()  → 카카오페이 결제창
        │           ├── 결제 성공 → POST /api/subscriptions/{id}/verify-payment
        │           │                 └── 백엔드: PortOne API 조회 → 금액 검증 → ACTIVE
        │           │                       └── navigate → SubscriptionCompletePage
        │           └── 결제 실패/취소 → 에러 메시지 표시
        │
        └── [PortOne 설정 없음]  (기존 모의 결제 유지)
              └── navigate → SubscriptionPaymentCallbackPage.jsx
```

## 참고할 기존 코드: OrderPaymentPage.jsx

서점 주문에 이미 PortOne이 연결되어 있으므로 **같은 패턴을 복사**하면 됩니다.

```javascript
// OrderPaymentPage.jsx의 PortOne 결제 호출 (이미 작동 중)
import * as PortOne from '@portone/browser-sdk/v2';

const PORTONE_STORE_ID = import.meta.env.VITE_PORTONE_STORE_ID;
const PORTONE_CHANNEL_KEY = import.meta.env.VITE_PORTONE_CHANNEL_KEY;

async function handlePortOnePayment(createdOrder) {
  const paymentId = `order_${createdOrder.id}_${Date.now()}`;

  const paymentResponse = await PortOne.requestPayment({
    storeId: PORTONE_STORE_ID,
    channelKey: PORTONE_CHANNEL_KEY,
    paymentId,
    orderName: '도서명...',
    totalAmount: createdOrder.totalPrice,
    currency: 'CURRENCY_KRW',
    payMethod: 'EASY_PAY',
    easyPay: { easyPayProvider: 'EASY_PAY_PROVIDER_KAKAOPAY' },
  });

  // 백엔드 검증
  await verifyOrderPayment(createdOrder.id, { paymentId });
}
```

## 수정이 필요한 파일과 내용

### 프론트엔드

#### 1) `frontend/src/api/subscription.js` — 검증 API 추가

```javascript
// 추가
export function verifySubscriptionPayment(subscriptionId, body) {
  return api.post(`/api/subscriptions/${subscriptionId}/verify-payment`, body);
}
```

#### 2) `frontend/src/pages/subscription/SubscriptionPaymentPage.jsx` — PortOne 연동

```javascript
import * as PortOne from '@portone/browser-sdk/v2';
import { createSubscription, verifySubscriptionPayment } from '../../api/subscription';
import { clearSubscriptionCheckoutDraft } from '../../data/subscriptionCheckoutStorage';

const PORTONE_STORE_ID = import.meta.env.VITE_PORTONE_STORE_ID;
const PORTONE_CHANNEL_KEY = import.meta.env.VITE_PORTONE_CHANNEL_KEY;

async function handleStartPayment() {
  setSubmitting(true);
  try {
    // 1. 구독 생성 (PENDING)
    const response = await createSubscription({
      planKey: selectedPlan.key,
      paymentMethod: SUBSCRIPTION_PAYMENT_METHOD.key,
    });
    const createdSubscription = response.data?.data ?? response.data;

    // 2. PortOne 설정 여부에 따라 분기
    if (PORTONE_STORE_ID) {
      await handlePortOnePayment(createdSubscription);
    } else {
      // 기존 모의 결제 유지
      navigate(`/subscription/payment/callback/${createdSubscription.id}`, {
        replace: true,
        state: { createdSubscription },
      });
    }
  } catch (err) {
    if (err?.isPortOneError) return;
    setError(err.response?.data?.error?.message ?? '결제 준비 중 문제가 발생했습니다.');
  } finally {
    setSubmitting(false);
  }
}

async function handlePortOnePayment(createdSubscription) {
  const paymentId = `sub_${createdSubscription.id}_${Date.now()}`;

  const paymentResponse = await PortOne.requestPayment({
    storeId: PORTONE_STORE_ID,
    channelKey: PORTONE_CHANNEL_KEY,
    paymentId,
    orderName: `AI멘토 구독 — ${selectedPlan.name}`,
    totalAmount: selectedPlan.paymentAmount,
    currency: 'CURRENCY_KRW',
    payMethod: 'EASY_PAY',
    easyPay: { easyPayProvider: 'EASY_PAY_PROVIDER_KAKAOPAY' },
  });

  if (paymentResponse?.code) {
    setError(`결제가 취소되었거나 실패했습니다. (${paymentResponse.message ?? paymentResponse.code})`);
    throw { isPortOneError: true };
  }

  // 3. 백엔드 검증
  const verifyResponse = await verifySubscriptionPayment(createdSubscription.id, { paymentId });
  const confirmedSub = verifyResponse.data?.data ?? verifyResponse.data;

  clearSubscriptionCheckoutDraft();
  navigate(`/subscription/complete/${confirmedSub.id}`, {
    replace: true,
    state: { createdSubscription: confirmedSub },
  });
}
```

### 백엔드

#### 3) `SubscriptionController.java` — 검증 엔드포인트 추가

```java
@PostMapping("/{id}/verify-payment")
public ResponseEntity<ApiResponse<SubscriptionResponse>> verifyPayment(
    @PathVariable Long id,
    @RequestBody @Valid PortOneVerifyRequestDto request,
    @AuthenticationPrincipal UserPrincipal principal
) {
    SubscriptionResponse response = subscriptionService.verifyAndConfirmPayment(
        id, request.getPaymentId(), principal.getId()
    );
    return ResponseEntity.ok(ApiResponse.success(response));
}
```

#### 4) `SubscriptionService.java` — 검증 로직 추가

```java
@Transactional
public SubscriptionResponse verifyAndConfirmPayment(Long subscriptionId, String paymentId, Long userId) {
    Subscription subscription = findByIdAndUserId(subscriptionId, userId);

    if (subscription.getStatus() != SubscriptionStatus.PENDING) {
        throw new BusinessException(ErrorCode.INVALID_SUBSCRIPTION_STATUS);
    }

    // PortOne API로 결제 상태 + 금액 검증
    portOneService.verifyPayment(paymentId, subscription.getPaymentAmount());

    // 기존 활성 구독 만료 처리
    expireExistingActiveSubscriptions(userId);

    // 구독 활성화
    subscription.activate();
    return SubscriptionResponse.from(subscription);
}
```

## 예상 작업량

| 항목 | 파일 | 변경량 |
|------|------|--------|
| API 함수 추가 | `frontend/src/api/subscription.js` | +4줄 |
| PortOne 연동 | `SubscriptionPaymentPage.jsx` | ~60줄 수정 |
| 검증 엔드포인트 | `SubscriptionController.java` | +15줄 |
| 검증 서비스 | `SubscriptionService.java` | +20줄 |

---

# 3단계 — 세션 종료 시 ChromaDB 컬렉션 정리

## 현재 상태 (AS-IS)

```
[면접 세션 종료 흐름 — 현재]

InterviewSessionPage.jsx
  └── 면접 종료 버튼 클릭
        └── POST /api/interviews/{sessionId}/end

Spring Boot InterviewService.java
  └── endSession()
        ├── 세션 상태 → COMPLETED
        ├── 피드백 생성 요청 (ai-server)
        └── 완료                          ChromaDB: session_42 그대로 남음 ✗
```

**문제:** 세션이 끝나도 ChromaDB의 `session_42` 컬렉션이 계속 남아있어 스토리지가 누적됩니다.

## 목표 상태 (TO-BE)

```
[면접 세션 종료 흐름 — 목표]

Spring Boot InterviewService.java
  └── endSession()
        ├── 세션 상태 → COMPLETED
        ├── 피드백 생성 요청 (ai-server)
        └── ★ 벡터 컬렉션 삭제 요청       ChromaDB: session_42 삭제됨 ✓
              └── DELETE /vector/{sessionId}
                    └── ai-server: delete_session_collection(sessionId)
```

## 이미 준비된 코드

ai-server에는 이미 삭제 함수가 구현되어 있습니다:

```python
# ai-server/services/vector_service.py (이미 존재!)
def delete_session_collection(session_id: str) -> None:
    try:
        client = _get_client()
        collection_name = f"session_{session_id}"
        client.delete_collection(name=collection_name)
        logger.info("세션 컬렉션 삭제: %s", collection_name)
    except Exception as error:
        logger.warning("컬렉션 삭제 실패 (이미 없거나 오류): %s — %s", session_id, error)
```

**필요한 건 이 함수를 호출하는 API 엔드포인트와, Spring Boot에서 그 API를 호출하는 것뿐입니다.**

## 수정이 필요한 파일과 내용

### ai-server

#### 1) `ai-server/routers/document.py` — 삭제 엔드포인트 추가

```python
from services.vector_service import delete_session_collection

@router.delete(
    "/vector/{session_id}",
    summary="세션 벡터 컬렉션 삭제",
    description="면접 종료 시 해당 세션의 ChromaDB 컬렉션을 삭제합니다.",
)
async def delete_vector_collection(session_id: str):
    delete_session_collection(session_id)
    return {"message": f"session_{session_id} 컬렉션 삭제 완료"}
```

### Spring Boot

#### 2) `PythonAiService.java` — 삭제 호출 메서드 추가

```java
public void deleteVectorCollection(String sessionId) {
    try {
        restTemplate.delete(aiServerUrl + "/extract/vector/" + sessionId);
        log.debug("벡터 컬렉션 삭제 완료: session_{}", sessionId);
    } catch (Exception e) {
        log.warn("벡터 컬렉션 삭제 실패 (무시): session_{} — {}", sessionId, e.getMessage());
    }
}
```

#### 3) `InterviewService.java` — 세션 종료 시 호출

```java
public InterviewSessionResponse endSession(Long sessionId, Long userId) {
    // ... 기존 종료 로직 ...

    // ★ 추가: 벡터 컬렉션 정리
    aiService.deleteVectorCollection(session.getId().toString());

    return InterviewSessionResponse.from(session);
}
```

## 예상 작업량

| 항목 | 파일 | 변경량 |
|------|------|--------|
| 삭제 엔드포인트 | `ai-server/routers/document.py` | +10줄 |
| 삭제 호출 메서드 | `PythonAiService.java` | +8줄 |
| 종료 시 호출 | `InterviewService.java` | +2줄 |

---

# 전체 작업 요약

| 단계 | 핵심 | 변경 파일 수 | 난이도 |
|------|------|-------------|--------|
| 1단계 RAG 연결 | interview_service.py에서 첫 질문 시 자동 벡터화 | 1개 | 낮음 |
| 2단계 PortOne 구독 | OrderPaymentPage 패턴을 구독에 복사 | 4개 | 중간 |
| 3단계 컬렉션 정리 | DELETE 엔드포인트 + 세션 종료 시 호출 | 3개 | 낮음 |

**권장 순서:** 1단계 → 3단계 → 2단계
- 1단계와 3단계는 ChromaDB 관련이라 함께 하는 게 효율적
- 2단계는 독립적이고 PortOne 계정 설정이 필요
