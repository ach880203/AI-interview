import asyncio
import json
import os
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Optional

from bs4 import BeautifulSoup
from fastapi import HTTPException
from openai import AsyncOpenAI

from schemas.scraping import JobPostingScrapedResponse

_PROMPT_DIR = Path(__file__).parent.parent / "prompts"

# 본문에서 제거할 노이즈 태그 (JSON-LD 추출 후에 제거)
# aside 제외: 원티드·잡코리아 등 한국 채용 사이트는 근무지를 aside(사이드바)에 렌더링
_NOISE_TAGS = ["style", "nav", "header", "footer", "iframe", "noscript"]

# 근무지 추출에 사용할 키워드
_LOCATION_KEYWORDS = ["근무지", "근무위치", "근무 위치", "근무 지역", "work location", "location", "지역"]

# GPT에 전달할 텍스트 최대 길이
_MAX_TEXT_CHARS = 8000

# Playwright 전용 스레드 풀 (uvicorn 이벤트 루프와 분리)
_playwright_executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="playwright")


def _run_playwright_sync(url: str) -> str:
    """
    별도 스레드에서 새 이벤트 루프로 Playwright를 실행합니다.

    [Windows 이벤트 루프 문제 해결]
    uvicorn은 자체 이벤트 루프(SelectorEventLoop)로 이미 실행 중입니다.
    SelectorEventLoop은 subprocess 생성을 지원하지 않아 Playwright가
    Chromium 프로세스를 실행할 때 NotImplementedError가 발생합니다.
    ThreadPoolExecutor로 별도 스레드를 만들고, 그 안에서 새 이벤트 루프를
    ProactorEventLoop으로 생성하면 uvicorn 루프와 완전히 분리되어 정상 실행됩니다.
    """
    # Windows: ProactorEventLoop은 subprocess_exec를 지원
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(_playwright_task(url))
    finally:
        loop.close()


async def _playwright_task(url: str) -> str:
    """
    Playwright로 JS 렌더링 완료된 HTML을 가져옵니다.

    [iframe 처리]
    잡코리아·사람인 등 일부 채용 사이트는 실제 공고 내용(주요업무·자격요건 등)을
    iframe 안에 렌더링합니다. 메인 프레임 HTML만 읽으면 내용이 거의 없으므로,
    모든 프레임의 HTML을 수집해 합칩니다.
    """
    from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeoutError

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-dev-shm-usage"],
        )
        context = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
            locale="ko-KR",
        )
        page = await context.new_page()
        try:
            await page.goto(url, wait_until="networkidle", timeout=25000)
        except PlaywrightTimeoutError:
            pass

        # 메인 프레임 + 모든 하위 iframe HTML 수집
        html_parts = []
        for frame in page.frames:
            try:
                # 광고·트래킹 프레임(criteo, about:blank 등) 제외
                frame_url = frame.url or ""
                if any(skip in frame_url for skip in ("criteo", "about:blank", "static.", "gum.")):
                    continue
                frame_html = await frame.content()
                if frame_html and len(frame_html) > 500:
                    html_parts.append(frame_html)
            except Exception:
                continue

        await browser.close()

    # 메인 프레임이 없으면 빈 문자열
    return "\n".join(html_parts) if html_parts else ""


async def _fetch_rendered_html(url: str) -> str:
    """uvicorn 이벤트 루프를 차단하지 않고 별도 스레드에서 Playwright를 실행합니다."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(_playwright_executor, _run_playwright_sync, url)


def _extract_json_ld(soup: BeautifulSoup) -> Optional[str]:
    """
    JSON-LD 구조화 데이터에서 JobPosting 정보를 추출합니다.
    schema.org/JobPosting 형식의 구조화 데이터가 있으면 GPT 추출 품질이 높아집니다.
    """
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(script.string or "")
            if isinstance(data, list):
                data = next(
                    (d for d in data if isinstance(d, dict) and d.get("@type") == "JobPosting"),
                    None,
                )
            if data and data.get("@type") == "JobPosting":
                return json.dumps(data, ensure_ascii=False)
        except (json.JSONDecodeError, AttributeError):
            continue
    return None


def _extract_location_hint(soup: BeautifulSoup) -> Optional[str]:
    """
    노이즈 제거 전에 근무지 관련 텍스트를 우선 추출합니다.

    [이유]
    원티드·잡코리아 등 한국 채용 사이트는 근무지(회사 주소)를
    aside 사이드바나 정보 테이블에 배치합니다.
    노이즈 제거 후 본문 텍스트가 8000자로 잘리면 이 정보가
    GPT에 전달되지 않을 수 있어 선제적으로 추출합니다.
    """
    # 1) JSON-LD의 jobLocation 필드 우선 탐색
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(script.string or "")
            if isinstance(data, list):
                data = next(
                    (d for d in data if isinstance(d, dict) and d.get("@type") == "JobPosting"),
                    None,
                )
            if data:
                loc = data.get("jobLocation") or data.get("addressLocality")
                if loc:
                    if isinstance(loc, dict):
                        addr = loc.get("address", {})
                        parts = [addr.get("addressLocality"), addr.get("addressRegion"), addr.get("streetAddress")]
                        loc_str = " ".join(p for p in parts if p)
                        if loc_str:
                            return loc_str
                    elif isinstance(loc, str) and loc.strip():
                        return loc.strip()
        except (json.JSONDecodeError, AttributeError):
            continue

    # 2) 근무지 키워드가 포함된 엘리먼트의 인접 텍스트 탐색
    for keyword in _LOCATION_KEYWORDS:
        for el in soup.find_all(string=lambda t: t and keyword in t):
            parent = el.parent
            if parent is None:
                continue
            # 키워드를 담고 있는 부모의 형제 또는 부모 자체 텍스트
            sibling = parent.find_next_sibling()
            if sibling:
                text = sibling.get_text(strip=True)
                if text and 2 < len(text) < 150:
                    return text
            container = parent.parent
            if container:
                text = container.get_text(separator=" ", strip=True)
                if text and 2 < len(text) < 200:
                    return text
    return None


def _clean_text(soup: BeautifulSoup) -> str:
    """노이즈 태그 제거 후 본문 텍스트 추출."""
    for tag in soup.find_all(_NOISE_TAGS):
        tag.decompose()
    for tag in soup.find_all("script"):
        tag.decompose()

    parts = [
        text.strip()
        for text in soup.stripped_strings
        if text and len(text.strip()) > 2
    ]
    return "\n".join(parts)[:_MAX_TEXT_CHARS]


def _is_valid_item(item: str) -> bool:
    """description 섹션에 포함하면 안 되는 항목을 걸러냅니다."""
    if not item:
        return False
    stripped = item.strip()
    if len(stripped) < 2:
        return False
    if stripped in ("---", "--", "-", "—"):
        return False
    if "http://" in stripped or "https://" in stripped:
        return False
    if any(ch in stripped for ch in ("📌", "🔗", "📎", "🏢")):
        return False
    return True


def _format_description(data: dict) -> str:
    """GPT 응답 dict → 모의면접에 활용 가능한 구조화된 텍스트 포맷."""
    def _bullet_list(items) -> Optional[str]:
        if not items or not isinstance(items, list):
            return None
        valid = [str(item).strip() for item in items if _is_valid_item(str(item))]
        if not valid:
            return None
        return "\n".join(f"  • {item}" for item in valid)

    field_labels = [
        ("main_tasks", "[주요업무]"),
        ("requirements", "[자격요건]"),
        ("preferred", "[우대사항]"),
        ("tech_stack", "[기술스택]"),
        ("benefits", "[복지 및 혜택]"),
    ]

    sections = []
    for field, label in field_labels:
        items = data.get(field) or []
        formatted = _bullet_list(items)
        if formatted:
            sections.append(f"{label}\n{formatted}")

    if not sections:
        return "채용공고 세부 내용을 추출하지 못했습니다."

    return "\n\n".join(sections)


async def scrape_job_posting(url: str) -> JobPostingScrapedResponse:
    """
    채용공고 URL에서 구조화된 모의면접 정보를 추출합니다.

    [동작 방식]
    1. Playwright 헤드리스 브라우저로 JS 렌더링까지 완료된 HTML을 가져옵니다.
    2. JSON-LD 구조화 데이터를 script 태그 제거 전에 추출합니다.
    3. 노이즈 태그를 제거하고 본문 텍스트를 정제합니다.
    4. GPT-4o에 전달해 주요업무·자격요건·기술스택·마감일 등을 추출합니다.
    """
    # 1. Playwright로 JS 렌더링 완료 후 HTML 가져오기
    try:
        html = await _fetch_rendered_html(url)
    except Exception as error:
        raise HTTPException(status_code=503, detail=f"채용공고 페이지를 가져오지 못했습니다: {error}")

    soup = BeautifulSoup(html, "html.parser")

    # 2. JSON-LD 구조화 데이터 추출 (script 태그 제거 전)
    json_ld_content = _extract_json_ld(soup)

    # 3. 근무지 힌트를 노이즈 제거 전에 우선 추출
    location_hint = _extract_location_hint(soup)

    # 4. 노이즈 제거 후 본문 텍스트 추출
    clean_content = _clean_text(soup)

    sections = []
    if json_ld_content:
        sections.append(f"[구조화 데이터 JSON-LD]\n{json_ld_content[:3000]}")
    if location_hint:
        sections.append(f"[근무지 힌트 (HTML에서 사전 추출)]\n{location_hint}")
    sections.append(f"[본문 텍스트]\n{clean_content[:5000]}")
    full_content = "\n\n".join(sections)

    if not full_content.strip():
        raise HTTPException(status_code=400, detail="채용공고 본문을 추출하지 못했습니다.")

    # 4. GPT-4o로 구조화된 정보 추출
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="OPENAI_API_KEY가 설정되지 않았습니다.")

    system_prompt = (_PROMPT_DIR / "scrape_job_posting_system.txt").read_text(encoding="utf-8").strip()
    human_template = (_PROMPT_DIR / "scrape_job_posting_human.txt").read_text(encoding="utf-8").strip()
    human_prompt = human_template.format(url=url, content=full_content)

    client = AsyncOpenAI(api_key=api_key)
    model = os.getenv("MODEL_NAME", "gpt-4o")

    try:
        gpt_response = await client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": human_prompt},
            ],
            temperature=0.1,
            max_tokens=2000,
            response_format={"type": "json_object"},
        )
        raw = gpt_response.choices[0].message.content.strip()
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=502, detail=f"AI 응답 파싱 실패: {e}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI 채용공고 분석 실패: {e}")

    # 5. 결과 조립
    company = (data.get("company") or "").strip() or "채용 사이트"
    position = (data.get("position") or "").strip() or "채용공고"
    location: Optional[str] = (data.get("location") or "").strip() or None
    due_date: Optional[str] = data.get("due_date") or None
    description = _format_description(data)

    return JobPostingScrapedResponse(
        company=company,
        position=position,
        description=description,
        location=location,
        due_date=due_date,
        source_url=url,
    )
