import json
import logging
import os
from pathlib import Path
import re
from typing import List, Optional

from fastapi import HTTPException
from openai import AsyncOpenAI

from schemas.interview import (
    ConversationTurn,
    DailyPracticeResponse,
    InterviewFeedbackResponse,
    InterviewQuestionResponse,
)
from services.asset_vector_service import (
    search_interview_question_assets,
    upsert_interview_question_asset,
)
from services.vector_service import search_similar, upsert_document

logger = logging.getLogger(__name__)

_PROMPT_DIR = Path(__file__).parent.parent / "prompts"


def _load_prompt(filename: str) -> str:
    return (_PROMPT_DIR / filename).read_text(encoding="utf-8").strip()


def _get_client() -> AsyncOpenAI:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="OPENAI_API_KEY가 설정되지 않았습니다.")
    return AsyncOpenAI(api_key=api_key)


def _format_history(history: List[ConversationTurn]) -> str:
    if not history:
        return "(없음)"
    lines = []
    for i, turn in enumerate(history, 1):
        lines.append(f"Q{i}: {turn.question}")
        lines.append(f"A{i}: {turn.answer or '(답변 없음)'}")
    return "\n".join(lines)


def _resolve_question_type(history: List[ConversationTurn], question_type: str | None) -> str:
    if question_type:
        return question_type
    return "INITIAL" if not history else "FOLLOWUP"


async def _build_rag_context(session_id: Optional[str], query: str) -> str:
    """
    세션 ID로 ChromaDB에서 유사 청크를 검색해 RAG 컨텍스트 문자열을 만듭니다.

    [동작]
    - session_id가 없거나 벡터 검색에 실패하면 "(없음)"을 반환합니다.
    - 검색된 청크는 번호를 붙여 이어 붙입니다.
    """
    if not session_id:
        return "(없음)"

    chunks = await search_similar(session_id, query, n_results=3)

    if not chunks:
        return "(없음)"

    logger.info("RAG 컨텍스트 %d개 청크 주입: session_id=%s", len(chunks), session_id)
    return "\n\n".join(f"[관련 청크 {i + 1}]\n{chunk}" for i, chunk in enumerate(chunks))


async def _auto_index_documents(
    session_id: str,
    resume_content: str | None,
    cover_letter_content: str | None,
    job_description: str | None,
) -> None:
    """
    첫 번째 질문 생성 시 전달받은 문서를 ChromaDB에 자동으로 벡터화해 저장합니다.

    [호출 시점]
    conversation_history가 비어 있을 때(= 첫 질문)에만 호출합니다.
    이미 저장된 세션이라도 upsert이므로 중복 저장은 덮어씁니다.

    [실패 처리]
    벡터화 실패는 WARNING 로그만 남기고 면접 진행을 차단하지 않습니다.
    RAG가 동작하지 않아도 기본 GPT 질문 생성은 항상 수행됩니다.
    """
    docs = [
        ("resume", resume_content),
        ("cover_letter", cover_letter_content),
        ("job_description", job_description),
    ]
    for doc_id, text in docs:
        if not text:
            continue
        try:
            chunk_count = await upsert_document(session_id, doc_id, text)
            logger.info("문서 자동 벡터화 완료: session_id=%s doc_id=%s chunks=%d",
                        session_id, doc_id, chunk_count)
        except Exception as error:
            logger.warning("문서 자동 벡터화 실패 (RAG 건너뜀): session_id=%s doc_id=%s error=%s",
                           session_id, doc_id, error)


def _extract_keywords(text: str | None, limit: int = 5) -> list[str]:
    if not text:
        return []

    tokens: list[str] = []
    for chunk in text.replace("\n", " ").split():
        cleaned = chunk.strip(".,()[]{}:;\"' ")
        if len(cleaned) < 2:
            continue
        if cleaned in tokens:
            continue
        tokens.append(cleaned)
        if len(tokens) >= limit:
            break
    return tokens


def _resolve_job_family(job_description: str | None) -> str | None:
    keywords = _extract_keywords(job_description, limit=3)
    return " / ".join(keywords) if keywords else None


def _normalize_keyword_set(keywords: list[str]) -> set[str]:
    normalized: set[str] = set()
    for keyword in keywords:
        cleaned = keyword.strip().lower()
        if len(cleaned) >= 2:
            normalized.add(cleaned)
    return normalized


def _normalize_question_text(question: str | None) -> str:
    """
    중복 질문 비교용 정규화 문자열을 만듭니다.

    공백, 줄바꿈 정도만 다른 같은 질문을 다시 내지 않도록
    비교 전에 소문자 + 공백 정리 형태로 맞춥니다.
    """
    if not question:
        return ""
    return " ".join(question.lower().split())


def _coerce_score(value: object, default: int, field_name: str) -> int:
    """
    AI가 점수 필드를 숫자 대신 "80점", "약 70" 같은 문자열로 줄 때도
    서버가 500으로 죽지 않고 기본값으로 복구하도록 안전하게 정규화합니다.

    [주의]
    면접 종료 API는 피드백 저장까지 한 트랜잭션으로 묶여 있어 여기서 예외가 나면
    세션 완료 처리 자체가 롤백됩니다. 따라서 점수 파싱은 최대한 방어적으로 처리합니다.
    """
    if value is None:
        return default

    if isinstance(value, bool):
        logger.warning("피드백 점수 필드 형식이 잘못되었습니다. field=%s value=%s", field_name, value)
        return default

    if isinstance(value, (int, float)):
        return max(0, min(100, int(round(value))))

    if isinstance(value, str):
        stripped_value = value.strip()
        if not stripped_value:
            return default

        matched_number = re.search(r"-?\d+(?:\.\d+)?", stripped_value)
        if matched_number:
            return max(0, min(100, int(round(float(matched_number.group(0))))))

    logger.warning("피드백 점수 필드 파싱에 실패했습니다. field=%s value=%s", field_name, value)
    return default


def _coerce_str(value: object) -> str:
    """AI가 문자열 필드를 dict로 반환할 때 읽기 좋은 문자열로 변환합니다."""
    if isinstance(value, dict):
        return "\n\n".join(f"{k}\n{v}" for k, v in value.items())
    if value is None:
        return ""
    return str(value)


def _build_asked_question_set(conversation_history: List[ConversationTurn]) -> set[str]:
    """
    이미 사용자에게 노출한 질문 목록을 정규화 집합으로 만듭니다.

    저장 자산 재사용과 신규 AI 생성 모두 같은 기준으로 중복을 막기 위해 사용합니다.
    """
    asked_questions: set[str] = set()
    for turn in conversation_history:
        normalized_question = _normalize_question_text(turn.question)
        if normalized_question:
            asked_questions.add(normalized_question)
    return asked_questions


def _score_interview_asset_candidate(
    metadata: dict,
    resolved_type: str,
    resume_keywords: list[str],
    job_keywords: list[str],
    job_family: str | None,
) -> int:
    """
    검색된 면접 자산 후보를 간단한 규칙 기반으로 다시 점수화합니다.

    [의도]
    벡터 검색 결과만 바로 쓰면 질문 유형은 맞지만 직무 맥락이 엇나갈 수 있습니다.
    그래서 질문 유형 일치, 키워드 겹침, 직무군 일치를 더해 재사용 후보를 고릅니다.
    """
    score = 0

    if str(metadata.get("question_type") or "").upper() == resolved_type.upper():
        score += 4

    candidate_resume_keywords = _normalize_keyword_set(metadata.get("resume_keywords") or [])
    candidate_job_keywords = _normalize_keyword_set(metadata.get("job_keywords") or [])
    source_resume_keywords = _normalize_keyword_set(resume_keywords)
    source_job_keywords = _normalize_keyword_set(job_keywords)

    score += len(candidate_resume_keywords & source_resume_keywords) * 2
    score += len(candidate_job_keywords & source_job_keywords) * 2

    candidate_job_family = str(metadata.get("job_family") or "").strip().lower()
    if job_family and candidate_job_family and job_family.lower() == candidate_job_family:
        score += 3

    question_text = str(metadata.get("question_text") or "").strip()
    if question_text:
        score += 1

    return score


def _select_reusable_interview_question(
    reusable_assets: list[dict],
    resolved_type: str,
    resume_keywords: list[str],
    job_keywords: list[str],
    job_family: str | None,
    asked_question_set: set[str],
) -> str | None:
    best_question: str | None = None
    best_score = -1

    for asset in reusable_assets:
        metadata = asset.get("metadata") or {}
        question_text = str(metadata.get("question_text") or "").strip()
        if not question_text:
            continue
        if _normalize_question_text(question_text) in asked_question_set:
            continue

        score = _score_interview_asset_candidate(
            metadata=metadata,
            resolved_type=resolved_type,
            resume_keywords=resume_keywords,
            job_keywords=job_keywords,
            job_family=job_family,
        )
        if score > best_score:
            best_score = score
            best_question = question_text

    return best_question if best_score >= 4 else None


async def _generate_ai_interview_question(
    resume_content: str | None,
    cover_letter_content: str | None,
    job_description: str | None,
    conversation_history: List[ConversationTurn],
    resolved_type: str,
    session_id: str | None,
    forbidden_questions: list[str],
) -> InterviewQuestionResponse:
    rag_query = " ".join(filter(None, [resume_content, job_description]))
    rag_context = await _build_rag_context(session_id, rag_query or "硫댁젒 吏덈Ц")

    system_prompt = _load_prompt("interview_question_system.txt")
    human_template = _load_prompt("interview_question_human.txt")

    human_prompt = human_template.format(
        question_type=resolved_type,
        resume_content=resume_content or "(없음)",
        cover_letter_content=cover_letter_content or "(없음)",
        job_description=job_description or "(없음)",
        conversation_history=_format_history(conversation_history),
        rag_context=rag_context,
    )

    if forbidden_questions:
        forbidden_lines = "\n".join(f"- {question}" for question in forbidden_questions)
        human_prompt += (
            "\n\n[중복 방지 규칙]\n"
            "아래 질문들과 의미가 같거나 표현만 바꾼 중복 질문은 절대 만들지 마세요.\n"
            f"{forbidden_lines}\n"
            "반드시 다른 각도의 후속 질문 1개만 생성하세요."
        )

    client = _get_client()
    model = os.getenv("MODEL_NAME", "gpt-4o")

    try:
        response = await client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": human_prompt},
            ],
            temperature=0.7,
            max_tokens=300,
        )
        question = response.choices[0].message.content.strip()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI 질문 생성 실패: {e}")

    return InterviewQuestionResponse(
        question=question,
        questionType=resolved_type,
    )


async def _store_generated_interview_question(
    question: str,
    question_type: str,
    resume_content: str | None,
    job_description: str | None,
    conversation_history: List[ConversationTurn],
) -> None:
    """
    새로 생성된 면접 질문을 출제 자산 컬렉션에 저장합니다.
    """
    try:
        await upsert_interview_question_asset(
            question_type=question_type,
            question=question,
            job_family=_resolve_job_family(job_description),
            resume_keywords=_extract_keywords(resume_content),
            job_keywords=_extract_keywords(job_description),
            context_summary=_format_history(conversation_history),
            conversation_stage="INITIAL" if not conversation_history else "FOLLOWUP",
        )
    except Exception:
        # 자산 저장이 실패해도 질문 생성 자체는 막지 않습니다.
        return


async def generate_interview_question(
    resume_content: str | None,
    cover_letter_content: str | None,
    job_description: str | None,
    conversation_history: List[ConversationTurn],
    question_type: str | None = None,
    session_id: str | None = None,
) -> InterviewQuestionResponse:
    """
    면접 질문을 혼합 출제 방식으로 생성합니다.

    [현재 전략]
    - 문서 RAG는 그대로 유지
    - 질문 번호 기준 3개 중 1개는 저장 자산 재사용 시도
    - 나머지는 AI 신규 생성
    """
    resolved_type = _resolve_question_type(conversation_history, question_type)

    if session_id and not conversation_history:
        await _auto_index_documents(session_id, resume_content, cover_letter_content, job_description)

    question_number = len(conversation_history) + 1
    should_try_reuse = question_number % 3 == 1
    asked_question_set = _build_asked_question_set(conversation_history)
    forbidden_questions = [turn.question for turn in conversation_history if turn.question]
    resume_keywords = _extract_keywords(resume_content)
    job_keywords = _extract_keywords(job_description)
    job_family = _resolve_job_family(job_description)
    search_query = " ".join(
        filter(
            None,
            [
                resolved_type,
                resume_content,
                job_description,
            ],
        )
    )

    if should_try_reuse:
        try:
            reusable_assets = await search_interview_question_assets(
                query=search_query or "면접 질문",
                question_type=resolved_type,
                job_family=job_family,
                limit=5,
            )
            if not reusable_assets and job_family:
                reusable_assets = await search_interview_question_assets(
                    query=search_query or "硫댁젒 吏덈Ц",
                    question_type=resolved_type,
                    job_family=None,
                    limit=5,
                )
        except Exception as reuse_error:
            logger.warning("면접 질문 재사용 검색 실패 (신규 생성으로 대체): %s", reuse_error)
            reusable_assets = []
        if reusable_assets:
            reused_question = _select_reusable_interview_question(
                reusable_assets=reusable_assets,
                resolved_type=resolved_type,
                resume_keywords=resume_keywords,
                job_keywords=job_keywords,
                job_family=job_family,
                asked_question_set=asked_question_set,
            )
            if reused_question:
                return InterviewQuestionResponse(
                    question=reused_question,
                    questionType=resolved_type,
                )

    response: InterviewQuestionResponse | None = None
    for attempt in range(2):
        response = await _generate_ai_interview_question(
            resume_content=resume_content,
            cover_letter_content=cover_letter_content,
            job_description=job_description,
            conversation_history=conversation_history,
            resolved_type=resolved_type,
            session_id=session_id,
            forbidden_questions=forbidden_questions,
        )
        if _normalize_question_text(response.question) not in asked_question_set:
            break
        logger.warning("AI가 중복 질문을 생성해 재시도합니다: attempt=%d question=%s", attempt + 1, response.question)

    if response is None:
        raise HTTPException(status_code=502, detail="면접 질문을 생성하지 못했습니다.")
    await _store_generated_interview_question(
        question=response.question,
        question_type=response.questionType,
        resume_content=resume_content,
        job_description=job_description,
        conversation_history=conversation_history,
    )
    return response


async def generate_feedback(
    conversation_history: List[ConversationTurn],
    answer_durations: str | None = None,
    job_description: str | None = None,
) -> InterviewFeedbackResponse:
    if not conversation_history:
        raise HTTPException(status_code=400, detail="면접 기록이 없습니다.")

    system_prompt = _load_prompt("interview_feedback_system.txt")
    human_template = _load_prompt("interview_feedback_human.txt")

    human_prompt = human_template.format(
        conversation_history=_format_history(conversation_history),
        answer_durations=answer_durations or "(시간 데이터 없음)",
        job_description=job_description or "(채용공고 없음 — 키워드 분석 생략)",
    )

    client = _get_client()
    model = os.getenv("MODEL_NAME", "gpt-4o")

    try:
        response = await client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": human_prompt},
            ],
            temperature=0.3,
            max_tokens=8000,
            response_format={"type": "json_object"},
        )
        raw = response.choices[0].message.content.strip()
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=502, detail=f"AI 응답 파싱 실패: {e}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI 피드백 생성 실패: {e}")

    # 점수 필드는 AI 응답 변동성이 있어서 문자열/빈 값이 섞여도 기본값으로 복구합니다.
    logic_score = _coerce_score(data.get("logicScore"), 70, "logicScore")
    relevance_score = _coerce_score(data.get("relevanceScore"), 70, "relevanceScore")
    specificity_score = _coerce_score(data.get("specificityScore"), 70, "specificityScore")
    communication_score = _coerce_score(data.get("communicationScore"), 70, "communicationScore")
    professionalism_score = _coerce_score(data.get("professionalismScore"), 70, "professionalismScore")
    overall_score = _coerce_score(
        data.get("overallScore"),
        round((logic_score + relevance_score + specificity_score + communication_score + professionalism_score) / 5),
        "overallScore",
    )

    return InterviewFeedbackResponse(
        logicScore=logic_score,
        relevanceScore=relevance_score,
        specificityScore=specificity_score,
        communicationScore=communication_score,
        professionalismScore=professionalism_score,
        overallScore=overall_score,
        strengths=data.get("strengths", ""),
        weakPoints=data.get("weakPoints", ""),
        improvements=data.get("improvements", ""),
        questionFeedbacks=_coerce_str(data.get("questionFeedbacks", "")),
        attitudeScore=_coerce_score(data.get("attitudeScore"), 70, "attitudeScore"),
        attitudeFeedback=data.get("attitudeFeedback", ""),
        starScore=_coerce_score(data.get("starScore"), 60, "starScore"),
        consistencyScore=_coerce_score(data.get("consistencyScore"), 80, "consistencyScore"),
        consistencyFeedback=data.get("consistencyFeedback", ""),
        recommendedAnswer=data.get("recommendedAnswer", ""),
        timingAnalysis=data.get("timingAnalysis", ""),
        keywordAnalysis=data.get("keywordAnalysis", ""),
    )


async def evaluate_daily_practice(question: str, answer: str) -> DailyPracticeResponse:
    """오늘의 연습질문 답변을 간결하게 평가합니다."""
    if not answer.strip():
        raise HTTPException(status_code=400, detail="답변을 입력해주세요.")

    system_prompt = _load_prompt("daily_practice_system.txt")
    human_template = _load_prompt("daily_practice_human.txt")
    human_prompt = human_template.format(question=question, answer=answer)

    client = _get_client()
    model = os.getenv("MODEL_NAME", "gpt-4o")

    try:
        response = await client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": human_prompt},
            ],
            temperature=0.3,
            max_tokens=500,
            response_format={"type": "json_object"},
        )
        data = json.loads(response.choices[0].message.content.strip())
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=502, detail=f"AI 응답 파싱 실패: {e}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI 평가 실패: {e}")

    return DailyPracticeResponse(
        score=int(data.get("score", 50)),
        feedback=data.get("feedback", ""),
    )
