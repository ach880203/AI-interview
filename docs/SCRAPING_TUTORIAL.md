# 채용공고 스크래핑 완전 정복 — 선생님이 가르쳐 주는 교본

> **이 문서의 목적**
> 채용공고 URL 하나를 넣으면 주요업무·자격요건·기술스택·마감일까지 자동으로 뽑아오는
> 시스템을 만들면서 겪은 모든 개념을 처음부터 끝까지 설명합니다.
> 코드를 먼저 보는 것보다 **왜 이렇게 만들었는지**를 먼저 이해하는 것이 목표입니다.

---

## 목차

1. [웹 스크래핑이란?](#1-웹-스크래핑이란)
2. [정적 HTML vs SPA — 핵심 개념](#2-정적-html-vs-spa--핵심-개념)
3. [httpx — 빠르지만 한계가 있는 도구](#3-httpx--빠르지만-한계가-있는-도구)
4. [Playwright — 실제 브라우저를 코드로 조종하기](#4-playwright--실제-브라우저를-코드로-조종하기)
5. [BeautifulSoup — HTML에서 텍스트 꺼내기](#5-beautifulsoup--html에서-텍스트-꺼내기)
6. [JSON-LD — 사이트가 검색엔진에게 보내는 비밀 데이터](#6-json-ld--사이트가-검색엔진에게-보내는-비밀-데이터)
7. [GPT API — AI가 텍스트를 구조화하는 방법](#7-gpt-api--ai가-텍스트를-구조화하는-방법)
8. [전체 코드 흐름 한눈에 보기](#8-전체-코드-흐름-한눈에-보기)
9. [설치 및 실행 방법](#9-설치-및-실행-방법)
10. [자주 묻는 질문 (FAQ)](#10-자주-묻는-질문-faq)

---

## 1. 웹 스크래핑이란?

### 비유로 이해하기

> 당신이 도서관에 가서 책을 읽는다고 상상해보세요.
> - **일반 방문**: 도서관에 들어가서 직접 눈으로 책을 읽음
> - **스크래핑**: 로봇을 보내서 책 내용을 복사해 가져오게 함

웹 스크래핑은 프로그램이 웹사이트에 접속해서 HTML 문서를 가져온 뒤,
그 안에서 필요한 텍스트를 추출하는 기술입니다.

### 왜 필요한가?

사용자가 채용공고 URL을 입력하면, 우리 서비스는:

```
1. 해당 URL에 접속
2. 페이지에서 회사명, 포지션, 주요업무, 자격요건, 기술스택, 마감일 추출
3. 이 정보를 GPT에게 전달 → 모의면접 질문 생성
```

이 과정에서 사용자는 공고를 직접 복사-붙여넣기할 필요가 없습니다.

---

## 2. 정적 HTML vs SPA — 핵심 개념

### 이 개념이 왜 중요한가?

처음에 `httpx`만 사용했을 때 **[복지 및 혜택] 한두 줄만 나오는** 현상이 생겼습니다.
그 이유가 바로 이 개념 때문입니다.

---

### 정적(Static) HTML 사이트

> **음식점 비유**: 손님이 오면 미리 만들어 둔 요리를 바로 내어줍니다.

```
클라이언트(브라우저)  ──GET 요청──▶  서버
                    ◀──HTML 응답──  서버

응답 예시:
<html>
  <h1>백엔드 개발자 채용</h1>
  <p>주요업무: REST API 개발</p>   ← 처음부터 내용이 있음
</html>
```

- 서버가 **이미 완성된 HTML**을 반환
- httpx로 받아오면 바로 본문 내용이 있음
- 예: 위키피디아, 네이버 블로그 구버전

---

### SPA (Single Page Application) 사이트

> **음식점 비유**: 손님이 오면 빈 그릇만 줍니다. 요리는 별도로 주문해서 나중에 배달됩니다.

```
클라이언트(브라우저)  ──GET 요청──▶  서버
                    ◀──빈 HTML──  서버

빈 HTML 예시:
<html>
  <div id="app"></div>   ← 비어있음!
  <script src="main.js"></script>   ← JS가 나중에 내용을 채움
</html>

(이후 JavaScript 실행)
브라우저 → JS가 API 호출 → 서버에서 데이터 받아옴 → div#app에 내용 삽입

최종 화면:
<div id="app">
  <h1>백엔드 개발자 채용</h1>   ← JS가 채운 내용
  <p>주요업무: REST API 개발</p>
</div>
```

- **잡코리아, 사람인, 원티드** 등 현대 채용 플랫폼은 대부분 SPA
- httpx로 받으면 `<div id="app"></div>` 빈 껍데기만 옴
- 아무리 좋은 GPT 모델도 없는 내용은 추출 불가

### 한 눈에 비교

| | 정적 HTML | SPA |
|---|---|---|
| 서버가 반환하는 것 | 완성된 HTML | 빈 HTML + JS 파일 |
| 내용이 채워지는 시점 | 서버에서 즉시 | 브라우저에서 JS 실행 후 |
| httpx로 스크래핑 | ✅ 가능 | ❌ 빈 껍데기만 옴 |
| Playwright로 스크래핑 | ✅ 가능 | ✅ JS 실행 후 가능 |
| 대표 사이트 | 위키피디아 | 잡코리아, 사람인, 원티드 |

---

## 3. httpx — 빠르지만 한계가 있는 도구

### httpx가 하는 일

```python
import httpx

async with httpx.AsyncClient() as client:
    response = await client.get("https://example.com")
    print(response.text)   # HTML 문자열
```

`httpx`는 브라우저처럼 HTTP 요청을 보내고 응답을 받습니다.
단, **브라우저가 아니기 때문에 JavaScript를 실행하지 않습니다.**

### 봇 차단 문제

채용 사이트들은 스크래핑 봇을 막으려고 `User-Agent` 헤더를 확인합니다.

```python
# 기본 httpx 요청 헤더
User-Agent: python-httpx/0.27.0   ← "나는 봇입니다"라고 광고하는 것

# 결과: 403 Forbidden (접근 거부)
```

해결책 — 브라우저처럼 위장:

```python
headers = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
}
```

### httpx의 한계

```
httpx로 얻는 것    : <div id="app"></div>  (빈 껍데기)
실제로 필요한 것   : <div>주요업무: REST API...</div>  (JS 실행 후)
```

SPA 사이트에서는 본질적으로 httpx만으로 본문을 가져올 수 없습니다.

---

## 4. Playwright — 실제 브라우저를 코드로 조종하기

### Playwright가 하는 일

> **비유**: 로봇 팔이 실제 컴퓨터 앞에 앉아서 Chrome 브라우저를 직접 조종합니다.

Playwright는 **실제 Chrome(Chromium) 브라우저를 코드로 제어**합니다.
- 페이지에 접속
- JavaScript가 실행될 때까지 기다림
- 완전히 렌더링된 HTML 추출

### 설치 방법

```bash
# 1. Playwright 패키지 설치
pip install playwright

# 2. Chromium 브라우저 설치 (약 150MB)
playwright install chromium
```

### 기본 사용법

```python
from playwright.async_api import async_playwright

async with async_playwright() as pw:
    # 1. Chromium 브라우저 시작 (headless=True: 화면 없이 백그라운드에서 실행)
    browser = await pw.chromium.launch(headless=True)

    # 2. 새 탭(page) 열기
    page = await browser.new_page()

    # 3. URL 접속 + JS 실행 완료까지 대기
    await page.goto("https://www.jobkorea.co.kr/...", wait_until="networkidle")
    #                                                  ↑ 이게 핵심!
    #   "networkidle" = 네트워크 요청이 500ms 동안 없을 때
    #   = JavaScript가 모든 데이터를 불러온 상태

    # 4. 완전히 렌더링된 HTML 추출
    html = await page.content()

    await browser.close()
```

### wait_until 옵션 이해하기

| 옵션 | 의미 | 속도 |
|---|---|---|
| `"commit"` | 응답 헤더를 받자마자 | 가장 빠름 (내용 없음) |
| `"domcontentloaded"` | 기본 HTML 파싱 완료 | 빠름 |
| `"load"` | 이미지 등 리소스 로딩 완료 | 중간 |
| `"networkidle"` | 네트워크 요청 500ms 없음 | 느리지만 완전함 ✅ |

채용 사이트는 JS가 API를 호출해 데이터를 가져오므로 **`networkidle`** 이 필요합니다.

### 실제 프로젝트 코드

```python
from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeoutError

async def _fetch_rendered_html(url: str) -> str:
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(
            headless=True,
            args=[
                "--no-sandbox",           # Docker/Linux 환경에서 필요
                "--disable-dev-shm-usage" # 메모리 부족 방지
            ],
        )
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) ...",
            locale="ko-KR",   # 한국어 채용 사이트 대응
        )
        page = await context.new_page()

        try:
            await page.goto(url, wait_until="networkidle", timeout=25000)
            #                                               ↑ 25초 제한
        except PlaywrightTimeoutError:
            # 25초 안에 networkidle에 도달 못해도 현재까지 로딩된 내용으로 진행
            # 일부 사이트는 백그라운드 polling으로 절대 networkidle에 안 됨
            pass

        html = await page.content()
        await browser.close()
    return html
```

---

## 5. BeautifulSoup — HTML에서 텍스트 꺼내기

### HTML 구조 이해

```html
<html>
  <head>
    <script>광고 추적 코드...</script>    ← 필요 없음
    <style>.btn { color: red; }</style>  ← 필요 없음
  </head>
  <body>
    <nav>로그인 회원가입 채용공고</nav>    ← 필요 없음 (네비게이션)
    <main>
      <h1>백엔드 개발자 모집</h1>         ← 필요 ✅
      <p>주요업무: REST API 개발</p>      ← 필요 ✅
    </main>
    <footer>이용약관 개인정보처리방침</footer>  ← 필요 없음
  </body>
</html>
```

### BeautifulSoup으로 노이즈 제거

```python
from bs4 import BeautifulSoup

soup = BeautifulSoup(html, "html.parser")

# 불필요한 태그 통째로 제거
NOISE_TAGS = ["style", "nav", "header", "footer", "iframe", "noscript", "script"]
for tag in soup.find_all(NOISE_TAGS):
    tag.decompose()   # 태그와 그 안의 내용 전부 삭제

# 남은 텍스트만 추출
parts = [
    text.strip()
    for text in soup.stripped_strings   # 빈 줄, 공백 자동 제거
    if len(text.strip()) > 2            # 너무 짧은 텍스트 제외
]

clean_text = "\n".join(parts)
```

---

## 6. JSON-LD — 사이트가 검색엔진에게 보내는 비밀 데이터

### JSON-LD란?

구글 같은 검색엔진이 웹페이지의 내용을 잘 이해하도록,
사이트 운영자가 **기계가 읽기 좋은 구조화된 데이터**를 HTML에 포함시킵니다.

> **비유**: 식당 메뉴판(HTML)에 사람이 읽는 메뉴가 있고,
> 뒷면에는 배달 앱이 파싱하는 기계용 데이터(JSON-LD)가 있는 것

채용 사이트는 `schema.org/JobPosting` 형식으로 이 데이터를 제공합니다:

```html
<script type="application/ld+json">
{
  "@type": "JobPosting",
  "title": "백엔드 개발자",
  "hiringOrganization": {
    "name": "테크 스타트업"
  },
  "description": "주요업무: REST API 설계 및 개발...",
  "validThrough": "2026-04-30T23:59:59",   ← 마감일!
  "jobLocation": {
    "address": { "addressLocality": "서울" }
  }
}
</script>
```

### 왜 중요한가?

- SPA 사이트라도 **SEO(검색엔진 최적화)를 위해 JSON-LD는 정적 HTML에 포함**
- JavaScript 실행 전에도 이미 있음 → httpx로도 읽을 수 있음
- 구조화되어 있어서 GPT 없이도 마감일 등을 정확히 추출 가능

### 실제 추출 코드

```python
import json
from typing import Optional
from bs4 import BeautifulSoup

def _extract_json_ld(soup: BeautifulSoup) -> Optional[str]:
    # HTML 내 모든 JSON-LD 스크립트 탐색
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(script.string or "")

            # JSON-LD가 배열인 경우 (여러 구조화 데이터가 한 페이지에 있을 때)
            if isinstance(data, list):
                data = next(
                    (d for d in data if isinstance(d, dict) and d.get("@type") == "JobPosting"),
                    None,
                )

            # JobPosting 타입 발견!
            if data and data.get("@type") == "JobPosting":
                return json.dumps(data, ensure_ascii=False)

        except (json.JSONDecodeError, AttributeError):
            continue   # 파싱 실패 시 다음 스크립트로

    return None   # 없으면 None
```

---

## 7. GPT API — AI가 텍스트를 구조화하는 방법

### 문제 상황

Playwright로 가져온 텍스트는 이렇게 생겼습니다:

```
회사소개 지원하기 즐겨찾기 공유
백엔드 개발자 모집
자격요건 경력 3년 이상 Java Spring Boot 능숙자
우대사항 AWS 경험자 MSA 경험 우대
마감 2026.04.30 서울 강남구 연봉 협의
로그인 회원가입 이용약관...
```

이 텍스트에서 구조화된 JSON을 만들어 달라고 GPT에게 요청합니다.

### GPT에게 원하는 출력 형식 지정하기

#### 시스템 프롬프트 (역할 + 규칙 정의)

```
당신은 채용공고 분석 전문가입니다.
제공된 텍스트에서 모의면접 준비에 필요한 정보를 추출합니다.

[출력 형식]
{
  "company": "회사명",
  "position": "포지션명",
  "main_tasks": ["업무1", "업무2"],
  "requirements": ["요건1", "요건2"],
  "preferred": ["우대1", "우대2"],
  "tech_stack": ["기술1", "기술2"],
  "benefits": ["복지1", "복지2"],
  "due_date": "yyyy-MM-dd 또는 null"
}
```

#### Python 코드

```python
from openai import AsyncOpenAI

client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

response = await client.chat.completions.create(
    model="gpt-4o",
    messages=[
        {"role": "system", "content": system_prompt},  # 역할 + 규칙
        {"role": "user", "content": human_prompt},     # 실제 공고 텍스트
    ],
    temperature=0.1,      # 낮을수록 일관성 있는 출력 (0.0~1.0)
    max_tokens=2000,      # 최대 출력 길이
    response_format={"type": "json_object"},  # 반드시 JSON 객체로 출력
)

raw = response.choices[0].message.content
data = json.loads(raw)   # 문자열 → Python dict
```

### `response_format={"type": "json_object"}` 왜 필요한가?

GPT에게 "JSON으로 줘"라고 말만 하면 가끔 이렇게 옵니다:
```
네, 아래에 JSON을 제공해 드릴게요:
```json
{"company": "테크 스타트업"...}
```
```

`response_format={"type": "json_object"}`를 설정하면:
```json
{"company": "테크 스타트업"...}
```
- 설명 텍스트 없이 순수 JSON만 반환
- `json.loads()` 파싱이 항상 성공

### temperature 이해하기

| temperature | 특성 | 사용 시기 |
|---|---|---|
| `0.0~0.2` | 매우 일관적, 같은 입력 → 거의 같은 출력 | **정보 추출** (스크래핑) |
| `0.5~0.7` | 균형 잡힘 | 일반적인 질의응답 |
| `0.8~1.0` | 창의적, 다양한 출력 | 문제 생성, 글쓰기 |

스크래핑은 "있는 사실을 뽑아내는 것"이므로 `temperature=0.1`을 사용합니다.

---

## 8. 전체 코드 흐름 한눈에 보기

```
사용자 입력: "https://www.jobkorea.co.kr/..."
                    │
                    ▼
┌─────────────────────────────────────┐
│  1. Playwright 헤드리스 브라우저 시작  │
│     chromium.launch(headless=True)   │
│                                      │
│  2. URL 접속 + JS 렌더링 완료 대기    │
│     page.goto(url, wait_until=       │
│              "networkidle")          │
│                                      │
│  3. 완전히 렌더링된 HTML 추출         │
│     html = await page.content()      │
└─────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────┐
│  4. BeautifulSoup HTML 파싱          │
│     soup = BeautifulSoup(html)       │
│                                      │
│  5. JSON-LD 구조화 데이터 먼저 추출   │
│     _extract_json_ld(soup)           │
│     → schema.org/JobPosting 탐색     │
│                                      │
│  6. 노이즈 태그 제거                  │
│     script/style/nav/footer 삭제     │
│                                      │
│  7. 순수 텍스트 추출 (최대 8,000자)   │
│     "\n".join(soup.stripped_strings) │
└─────────────────────────────────────┘
                    │
                    ▼ (JSON-LD + 본문 텍스트 조합)
┌─────────────────────────────────────┐
│  8. GPT-4o 호출                      │
│     - system: 추출 규칙 + JSON 형식  │
│     - user: 실제 공고 텍스트         │
│     - response_format: json_object   │
│     - temperature: 0.1               │
└─────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────┐
│  9. GPT 응답 파싱                    │
│     data = json.loads(raw)           │
│                                      │
│  10. 노이즈 필터링                   │
│      "---", URL 포함 항목 제거       │
│                                      │
│  11. description 포맷팅              │
│      "[주요업무]\n  • ...\n\n..."    │
└─────────────────────────────────────┘
                    │
                    ▼
결과: JobPostingScrapedResponse(
  company="테크 스타트업",
  position="백엔드 개발자",
  description="[주요업무]\n  • REST API 개발\n\n[자격요건]\n  • Java 3년...",
  due_date="2026-04-30",
  source_url="https://..."
)
```

---

## 9. 설치 및 실행 방법

### 전체 의존성 설치

```bash
# 프로젝트 루트에서
cd ai-server

# venv 활성화 (Windows)
.venv313\Scripts\activate

# 의존성 설치
pip install -r requirements.txt

# Playwright Chromium 브라우저 설치 (필수! pip install만으로 부족)
playwright install chromium
```

### requirements.txt 확인

```
fastapi>=0.111.0
uvicorn[standard]>=0.30.0
openai>=1.30.0
httpx>=0.27.0
beautifulsoup4>=4.12.0
playwright>=1.44.0          ← 이게 있어야 함
```

### 환경변수 설정

```env
# ai-server/.env
OPENAI_API_KEY=sk-...       # OpenAI API 키 (필수)
MODEL_NAME=gpt-4o           # 사용할 모델 (기본값: gpt-4o)
```

### 서버 실행

```bash
# venv 활성화 상태에서
cd ai-server
uvicorn main:app --reload --port 8000
```

### API 테스트

```bash
curl -X POST http://localhost:8000/scrape/job-posting \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.jobkorea.co.kr/..."}'
```

예상 응답:
```json
{
  "company": "테크 스타트업",
  "position": "백엔드 개발자",
  "description": "[주요업무]\n  • REST API 설계 및 개발\n  • 서비스 성능 최적화\n\n[자격요건]\n  • Java/Spring Boot 3년 이상\n\n[기술스택]\n  • Java, Spring Boot, MySQL, AWS",
  "due_date": "2026-04-30",
  "source_url": "https://www.jobkorea.co.kr/..."
}
```

---

## 10. 자주 묻는 질문 (FAQ)

### Q1. GPT 모델을 더 좋은 걸로 바꾸면 정보가 더 잘 나오나요?

**A: 아니요.** 이미 최신 gpt-4o를 사용 중입니다.

정보 품질은 모델이 아니라 **입력 데이터 품질**에 달려 있습니다.

```
httpx (SPA 사이트) : 빈 HTML → gpt-4o-ultra 써도 출력 없음
Playwright (SPA)   : 완전한 HTML → gpt-3.5도 잘 추출
```

"Garbage In, Garbage Out" — 쓰레기를 넣으면 쓰레기가 나온다.

---

### Q2. Playwright가 너무 느린 것 같아요.

**A: 정상입니다.** httpx는 0.5~1초, Playwright는 5~15초 걸립니다.

왜냐하면:
1. 실제 Chrome 브라우저를 시작하는 시간
2. JavaScript 실행 완료(`networkidle`) 대기
3. 비동기 API 호출 대기

채용공고 스크래핑은 자주 호출되는 API가 아니므로(사용자당 하루 몇 번) 이 정도 지연은 허용 범위입니다. 프론트엔드에서 "AI가 분석 중..." 로딩 표시로 UX를 커버합니다.

---

### Q3. `playwright install chromium`을 매번 해야 하나요?

**A: 아니요.** 한 번만 설치하면 됩니다. Docker 환경에서는 `Dockerfile`에 추가:

```dockerfile
RUN pip install playwright && playwright install chromium
RUN playwright install-deps chromium   # Linux 시스템 의존성
```

---

### Q4. 일부 사이트에서 여전히 정보가 안 나와요.

몇 가지 원인이 있습니다:

| 원인 | 증상 | 대응 |
|---|---|---|
| 로그인 필요 사이트 | 로그인 페이지로 리다이렉트 | 지원 불가 (쿠키/세션 필요) |
| CAPTCHA | 로봇 확인 페이지 표시 | 지원 불가 |
| 지나친 봇 차단 | 빈 내용 or 403 | User-Agent, 딜레이 추가 |
| JS 렌더링 25초 초과 | PlaywrightTimeoutError | timeout 늘리기 |

---

### Q5. JSON-LD가 없는 사이트는요?

Playwright가 JS 렌더링 후 가져온 **본문 텍스트만으로** GPT가 추출합니다.
JSON-LD는 보조 수단이고, 없어도 Playwright + GPT 조합으로 대부분 추출 가능합니다.

---

### Q6. 이 기술을 다른 사이트 스크래핑에도 쓸 수 있나요?

**네, 똑같이 적용 가능합니다.** 흐름은 동일합니다:

```
URL → Playwright 렌더링 → BeautifulSoup 파싱
    → (JSON-LD 있으면 추출) → GPT 구조화 → 결과
```

예: 뉴스 기사 요약, 쇼핑몰 상품 정보 수집, 부동산 매물 정보 등

---

## 마무리 — 이번 개발에서 배운 것

```
1. 문제 진단이 먼저다
   "정보가 왜 안 나오지?" → httpx + SPA 구조 문제 파악 → Playwright 도입
   모델 탓, 프롬프트 탓 하기 전에 데이터 입력부터 확인

2. 도구마다 역할이 있다
   httpx      → 빠른 정적 HTML 수집
   Playwright → JS 렌더링이 필요한 SPA
   BeautifulSoup → HTML에서 텍스트 추출
   JSON-LD    → 구조화된 메타데이터 추출
   GPT        → 비구조화 텍스트 → 구조화된 JSON

3. LLM 출력은 항상 검증하고 필터링하라
   GPT는 입력에 있는 내용을 그대로 반영한다.
   노이즈 입력 → 노이즈 출력
   필터링 코드(_is_valid_item)가 없으면 "---", URL이 결과에 섞인다.
```
