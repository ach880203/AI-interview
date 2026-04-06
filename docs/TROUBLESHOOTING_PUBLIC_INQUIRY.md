# 트러블슈팅: 공개 문의가 공개글 목록에 표시되지 않는 버그

## 현상
- 고객센터에서 "공개글" 체크 후 문의를 등록해도, 공개글 섹션에 해당 문의가 나타나지 않음
- 관리자가 답변을 작성한 뒤에야 공개글 목록에 표시됨

## 원인 분석

### 수정 전 코드 (버그 원인)

**`CustomerCenterInquiryRepository.java`**
```java
/** 공개 문의 페이징 조회 (답변 완료된 것만) */
Page<CustomerCenterInquiryEntity> findAllByIsPublicTrueAndStatus(
        CustomerCenterInquiryEntity.InquiryStatus status, Pageable pageable);
```

**`CustomerCenterInquiryService.java`**
```java
public Page<CustomerCenterInquiryResponseDto> getPublicInquiries(int page, int size) {
    PageRequest pageable = PageRequest.of(page, size,
        Sort.by(Sort.Direction.DESC, "helpfulCount", "createdAt"));
    return customerCenterInquiryRepository
            .findAllByIsPublicTrueAndStatus(
                CustomerCenterInquiryEntity.InquiryStatus.ANSWERED, pageable)
            .map(CustomerCenterInquiryResponseDto::from);
}
```

**문제 포인트:**
- `findAllByIsPublicTrueAndStatus(ANSWERED, ...)` 쿼리는 `isPublic = true AND status = 'ANSWERED'` 조건으로 조회
- 새로 등록된 문의는 `status = 'WAITING'` 상태이므로 조건에 맞지 않아 결과에서 제외됨
- 관리자가 답변을 저장하면 `status`가 `ANSWERED`로 바뀌면서 그제야 목록에 나타남

### JPA 쿼리 메서드 이름 분석
Spring Data JPA의 쿼리 메서드 이름 규칙:
- `findAllBy` + `IsPublicTrue` + `And` + `Status(param)` → `WHERE is_public = true AND status = ?`
- `And` 키워드가 두 조건을 함께 묶으므로 **두 조건을 모두 만족**해야만 결과에 포함

## 수정 후 코드

**`CustomerCenterInquiryRepository.java`** (신규 메서드 추가)
```java
/**
 * 공개 문의 페이징 조회 (전체 상태 포함)
 * 새 공개 문의도 바로 목록에 표시하기 위해 상태 필터 없이 조회합니다.
 */
Page<CustomerCenterInquiryEntity> findAllByIsPublicTrue(Pageable pageable);
```

**`CustomerCenterInquiryService.java`**
```java
public Page<CustomerCenterInquiryResponseDto> getPublicInquiries(int page, int size) {
    PageRequest pageable = PageRequest.of(page, size,
        Sort.by(Sort.Direction.DESC, "helpfulCount", "createdAt"));
    return customerCenterInquiryRepository
            .findAllByIsPublicTrue(pageable)  // 상태 필터 제거
            .map(CustomerCenterInquiryResponseDto::from);
}
```

**변경 요약:**
| 항목 | 수정 전 | 수정 후 |
|------|---------|---------|
| Repository 메서드 | `findAllByIsPublicTrueAndStatus(ANSWERED, pageable)` | `findAllByIsPublicTrue(pageable)` |
| SQL WHERE 절 | `is_public = true AND status = 'ANSWERED'` | `is_public = true` |
| 새 공개글 표시 | 관리자 답변 후에만 표시 | 등록 즉시 표시 |

## 교훈
1. **JPA 쿼리 메서드 이름에 조건을 추가할 때**, 그 조건이 사용자 경험에 어떤 영향을 미치는지 전체 흐름을 검증해야 함
2. **상태 기반 필터는 양날의 검** — 데이터 무결성을 위해 상태 필터를 넣었지만, 사용자 입장에서는 "내가 쓴 글이 안 보인다"로 느껴짐
3. **프론트엔드에서 상태 배지를 표시**하면 WAITING/ANSWERED를 시각적으로 구분할 수 있어 필터 없이도 충분한 UX를 제공

## 재현 및 검증 방법
```
1. 고객센터 → 문의하기 → "공개글" 체크 → 문의 등록
2. 공개글 탭 확인 → 방금 등록한 문의가 즉시 표시되는지 확인
3. 관리자 페이지에서 해당 문의에 답변 작성
4. 공개글 탭 재확인 → 답변이 반영되었는지 확인
```
