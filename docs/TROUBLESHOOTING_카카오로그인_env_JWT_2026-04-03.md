# 카카오 로그인 실패 + `.env` 로딩 + JWT 시크릿 형식 충돌 트러블슈팅

## 1. 문서 목적

이 문서는 2026-04-03에 발생한 아래 장애를 정리한 기록입니다.

- 카카오 로그인 마지막 단계에서 `401 invalid_client`
- `.env`를 읽게 만든 뒤 백엔드 자체가 부팅 실패

한 번에 보면 별개 문제처럼 보이지만, 실제로는 아래 순서로 이어진 설정 문제였습니다.

1. 백엔드가 `.env`를 읽지 못해서 카카오 키가 비어 있었음
2. `.env`를 읽게 만들자 이번에는 `JWT_SECRET` 형식 차이 때문에 서버가 죽음

즉, 원인은 "카카오 로그인 코드 자체"보다 `설정 주입 방식`과 `JWT 시크릿 처리 방식`에 있었습니다.

---

## 2. 최초 증상

### 2-1. 카카오 로그인 실패 로그

```text
401 Unauthorized on POST request for "https://kauth.kakao.com/oauth/token":
{"error":"invalid_client","error_description":"Not exist client_id []","error_code":"KOE101"}
```

이 메시지는 매우 직접적입니다.

- `client_id`가 비어 있음
- 카카오가 앱 키를 전혀 받지 못함

즉 인가 코드 문제가 아니라, **백엔드 설정 주입 문제**였습니다.

### 2-2. `.env` import 후 백엔드 부팅 실패 로그

```text
Caused by: io.jsonwebtoken.io.DecodingException: Illegal base64 character: '_'
```

이 메시지는 `JWT_SECRET`를 Base64로 해석하다 실패했다는 뜻입니다.

즉 `.env`를 읽기 시작하면서 카카오 키는 들어올 준비가 됐지만, 동시에 `.env`의 JWT 시크릿까지 들어오면서 형식 충돌이 발생한 것입니다.

---

## 3. 실제 원인

## 3-1. 원인 1: Spring Boot가 `.env`를 자동으로 읽지 않았다

프로젝트에는 [backend/ai-interview/.env](/C:/Programmer/Work/AI-interview/backend/ai-interview/.env) 파일이 있었고,
그 안에 아래 값이 실제로 들어 있었습니다.

- `KAKAO_CLIENT_ID`
- `KAKAO_CLIENT_SECRET`

하지만 당시 설정은 [application.yml](/C:/Programmer/Work/AI-interview/backend/ai-interview/src/main/resources/application.yml) 에서 아래처럼 환경변수만 기대하고 있었습니다.

```yml
kakao:
  client-id: ${KAKAO_CLIENT_ID:}
  client-secret: ${KAKAO_CLIENT_SECRET:}
  redirect-uri: ${KAKAO_REDIRECT_URI:http://localhost:5173/auth/kakao/callback}
```

문제는 **Spring Boot가 `.env` 파일을 자동으로 읽는 구조가 아니었다는 점**입니다.

즉:

- `.env` 파일은 존재함
- 값도 채워져 있음
- 하지만 실행 중인 Spring Boot 프로세스는 그 파일을 읽지 않음
- 결과적으로 `KAKAO_CLIENT_ID=""`

그래서 카카오 토큰 교환 요청에 `client_id`가 빈 값으로 들어갔습니다.

---

## 3-2. 원인 2: `.env`의 `JWT_SECRET`는 일반 문자열인데 코드는 Base64만 허용했다

[JwtTokenProvider.java](/C:/Programmer/Work/AI-interview/backend/ai-interview/src/main/java/com/aimentor/security/JwtTokenProvider.java)는 기존에 아래처럼 동작했습니다.

### 수정 전 코드

```java
public JwtTokenProvider(
        @Value("${jwt.secret}") String secret,
        @Value("${jwt.access-expiration}") long accessExpiration,
        @Value("${jwt.refresh-expiration}") long refreshExpiration
) {
    // Base64 디코딩하여 HMAC-SHA256 키 생성
    this.secretKey = Keys.hmacShaKeyFor(Decoders.BASE64.decode(secret));
    this.accessExpiration = accessExpiration;
    this.refreshExpiration = refreshExpiration;
}
```

이 구조는 `jwt.secret`이 **반드시 Base64 문자열**일 때만 정상 동작합니다.

그런데 `.env`에는 사람이 읽기 쉬운 일반 문자열이 들어 있었습니다.

예:

```text
JWT_SECRET=hanspoon_secure_jwt_secret_key_2026_02_19_unified_key_256bit
```

이 값에는 `_`가 포함되어 있고, Base64로는 유효하지 않으므로 부팅 시 즉시 예외가 발생했습니다.

---

## 4. 수정 내용

## 4-1. 수정 1: `application.yml`에서 `.env`를 직접 import 하도록 변경

수정 파일:

- [application.yml](/C:/Programmer/Work/AI-interview/backend/ai-interview/src/main/resources/application.yml)

### 수정 전 코드

```yml
spring:
  application:
    name: ai-interview
```

### 수정 후 코드

```yml
spring:
  application:
    name: ai-interview

  config:
    import:
      # [의도]
      # backend/ai-interview/.env 파일의 KEY=VALUE 형식을 Spring 설정으로 직접 읽어들입니다.
      # .env 안의 '#' 주석 줄은 무시되고, 주석 처리되지 않은 값만 환경설정으로 반영됩니다.
      #
      # [주의]
      # 실행 위치에 따라 상대 경로가 달라질 수 있어 현재 프로젝트 폴더와 상위 워크스페이스 경로를 둘 다 열어둡니다.
      # 둘 중 존재하는 파일만 optional로 읽고, 없는 경로는 조용히 건너뜁니다.
      - optional:file:.env[.properties]
      - optional:file:backend/ai-interview/.env[.properties]
```

### 이 수정의 의미

- `.env` 안의 `KEY=VALUE` 형식을 Spring 설정으로 읽음
- `#` 주석 줄은 자동으로 무시
- 즉 **주석 처리되지 않은 값만 읽는다**

이걸로 카카오 키가 실제 런타임에 들어올 수 있게 됐습니다.

---

## 4-2. 수정 2: JWT 시크릿을 Base64/일반 문자열 둘 다 허용하도록 변경

수정 파일:

- [JwtTokenProvider.java](/C:/Programmer/Work/AI-interview/backend/ai-interview/src/main/java/com/aimentor/security/JwtTokenProvider.java)

### 수정 전 코드

```java
public JwtTokenProvider(
        @Value("${jwt.secret}") String secret,
        @Value("${jwt.access-expiration}") long accessExpiration,
        @Value("${jwt.refresh-expiration}") long refreshExpiration
) {
    // Base64 디코딩하여 HMAC-SHA256 키 생성
    this.secretKey = Keys.hmacShaKeyFor(Decoders.BASE64.decode(secret));
    this.accessExpiration = accessExpiration;
    this.refreshExpiration = refreshExpiration;
}
```

### 수정 후 코드

```java
public JwtTokenProvider(
        @Value("${jwt.secret}") String secret,
        @Value("${jwt.access-expiration}") long accessExpiration,
        @Value("${jwt.refresh-expiration}") long refreshExpiration
) {
    // [호환성]
    // 기존 application.yml 기본값은 Base64 문자열이고,
    // .env 에서는 사람이 읽기 쉬운 일반 문자열을 넣어둔 경우가 있습니다.
    // 둘 중 어느 형식이 들어와도 서버가 안전하게 부팅되도록
    // Base64 디코딩이 실패하면 UTF-8 원문 바이트를 그대로 HMAC 키로 사용합니다.
    this.secretKey = Keys.hmacShaKeyFor(resolveSecretBytes(secret));
    this.accessExpiration = accessExpiration;
    this.refreshExpiration = refreshExpiration;
}

private byte[] resolveSecretBytes(String secret) {
    try {
        return Decoders.BASE64.decode(secret);
    } catch (IllegalArgumentException decodeError) {
        log.warn("JWT_SECRET가 Base64 형식이 아니어서 UTF-8 원문 키로 처리합니다.");
        return secret.getBytes(StandardCharsets.UTF_8);
    }
}
```

### 이 수정의 의미

- `application.yml` 기본 Base64 시크릿 유지 가능
- `.env`의 일반 문자열 시크릿도 허용
- 즉 `.env`를 읽기 시작해도 JWT 때문에 서버가 바로 죽지 않음

---

## 5. 수정 후 기대 동작

수정 후 정상 흐름은 아래와 같습니다.

1. Spring Boot 시작
2. `.env` import
3. `KAKAO_CLIENT_ID`, `KAKAO_CLIENT_SECRET` 주입
4. `JWT_SECRET`는 Base64면 Base64로 사용
5. Base64가 아니면 UTF-8 원문 바이트로 사용
6. 백엔드 정상 부팅
7. 카카오 로그인 시 토큰 교환 요청에 `client_id`가 빈 값이 아니게 됨

---

## 6. 확인 방법

## 6-1. 서버 부팅 확인

백엔드 재시작 후 아래 오류가 더 이상 나오면 안 됩니다.

```text
Illegal base64 character: '_'
```

## 6-2. 카카오 로그인 재시도

카카오 로그인 시 아래 오류가 사라져야 합니다.

```text
Not exist client_id []
```

이 메시지가 사라졌다면 `.env`에서 카카오 키를 읽고 있다는 뜻입니다.

## 6-3. 다음으로 확인할 것

만약 카카오 로그인이 여전히 실패한다면 다음을 봐야 합니다.

1. 카카오 개발자 콘솔의 Redirect URI
2. [backend/ai-interview/.env](/C:/Programmer/Work/AI-interview/backend/ai-interview/.env)의 `KAKAO_REDIRECT_URI`
3. 프론트 콜백 주소

이 세 값이 **완전히 동일해야** 합니다.

---

## 7. 재발 방지 포인트

1. `.env` 파일이 있다고 해서 Spring Boot가 자동으로 읽는다고 가정하면 안 됩니다.
2. 시크릿 값은 "Base64 전용"인지 "일반 문자열 허용"인지 코드에서 명확히 정해야 합니다.
3. 카카오 로그인 오류에서 `invalid_client`, `client_id []`가 보이면 코드보다 설정을 먼저 봐야 합니다.
4. 외부 연동 키가 대화/로그/문서에 노출됐으면 실제 운영 키는 재발급하는 것이 안전합니다.

---

## 8. 이번 수정 대상 파일 요약

- [application.yml](/C:/Programmer/Work/AI-interview/backend/ai-interview/src/main/resources/application.yml)
- [JwtTokenProvider.java](/C:/Programmer/Work/AI-interview/backend/ai-interview/src/main/java/com/aimentor/security/JwtTokenProvider.java)

필요하면 다음 단계로 `카카오 로그인 실제 재검증 결과`까지 이 문서 아래에 이어서 추가하면 됩니다.
