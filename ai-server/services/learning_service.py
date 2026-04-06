import json
import logging
import os
import random
from pathlib import Path

from fastapi import HTTPException
from openai import AsyncOpenAI

from services.asset_vector_service import (
    search_learning_problem_assets,
    upsert_learning_problem_assets,
)
from schemas.learning import (
    LearningGradeResponse,
    LearningProblemItem,
    LearningProblemsResponse,
)

logger = logging.getLogger(__name__)
_RANDOM = random.SystemRandom()

_PROMPT_DIR = Path(__file__).parent.parent / "prompts"

_SUBJECT_SYSTEM_MAP = {
    "영어": "learning_generate_system_english.txt",
    "english": "learning_generate_system_english.txt",
    "국사": "learning_generate_system_history.txt",
    "한국사": "learning_generate_system_history.txt",
    "역사": "learning_generate_system_history.txt",
    "history": "learning_generate_system_history.txt",
    "it": "learning_generate_system_it.txt",
    "컴퓨터": "learning_generate_system_it.txt",
    "프로그래밍": "learning_generate_system_it.txt",
    "소프트웨어": "learning_generate_system_it.txt",
}


def _load_prompt(filename: str) -> str:
    return (_PROMPT_DIR / filename).read_text(encoding="utf-8").strip()


def _get_system_prompt(subject: str) -> str:
    key = subject.strip().lower()
    filename = _SUBJECT_SYSTEM_MAP.get(key, "learning_generate_system_default.txt")
    return _load_prompt(filename)


def _get_client() -> AsyncOpenAI:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="OPENAI_API_KEY가 설정되지 않았습니다.")
    return AsyncOpenAI(api_key=api_key)


def _extract_problem_items(raw: str) -> list[dict]:
    """
    모델 응답에서 문제 배열만 안전하게 꺼냅니다.
    """
    parsed = json.loads(raw)
    if isinstance(parsed, list):
        return parsed

    candidate = (
        parsed.get("problems")
        or parsed.get("questions")
        or parsed.get("items")
        or list(parsed.values())[0]
    )
    if isinstance(candidate, str):
        try:
            candidate = json.loads(candidate)
        except json.JSONDecodeError:
            pass
    return candidate if isinstance(candidate, list) else []


async def _generate_ai_problem_items(
    subject: str,
    difficulty: str,
    count: int,
    problem_type: str,
    user_accuracy: int | None = None,
) -> list[LearningProblemItem]:
    """
    기존 GPT 기반 문제 생성만 담당하는 내부 함수입니다.
    """
    system_prompt = _get_system_prompt(subject)
    human_template = _load_prompt("learning_generate_human.txt")

    accuracy_str = str(user_accuracy) if user_accuracy is not None else "정보 없음"
    human_prompt = human_template.format(
        subject=subject,
        difficulty=difficulty,
        problem_type=problem_type,
        count=count,
        user_accuracy=accuracy_str,
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
            temperature=0.8,
            max_tokens=2000,
            response_format={"type": "json_object"},
        )
        items = _extract_problem_items(response.choices[0].message.content.strip())
    except json.JSONDecodeError as error:
        raise HTTPException(status_code=502, detail=f"AI 문제 응답 변환 실패: {error}")
    except Exception as error:
        raise HTTPException(status_code=502, detail=f"AI 문제 생성 실패: {error}")

    problems: list[LearningProblemItem] = []
    for item in items[:count]:
        if not isinstance(item, dict):
            continue
        problems.append(
            LearningProblemItem(
                type=item.get("type", problem_type if problem_type != "MIX" else "MULTIPLE"),
                question=item.get("question", ""),
                choices=item.get("choices"),
                answer=item.get("answer", ""),
                explanation=item.get("explanation", ""),
            )
        )

    return problems


def _build_learning_search_query(
    subject: str,
    difficulty: str,
    problem_type: str,
    user_accuracy: int | None,
) -> str:
    accuracy_text = f"사용자 정답률 {user_accuracy}" if user_accuracy is not None else ""
    return " ".join(filter(None, [subject, difficulty, problem_type, accuracy_text]))


def _build_reused_problem_item(metadata: dict, fallback_problem_type: str) -> LearningProblemItem | None:
    question = str(metadata.get("question_text") or "").strip()
    answer = str(metadata.get("answer_text") or "").strip()
    explanation = str(metadata.get("explanation_text") or "").strip()
    if not question or not answer or not explanation:
        return None

    return LearningProblemItem(
        type=str(metadata.get("problem_type") or fallback_problem_type or "MULTIPLE"),
        question=question,
        choices=metadata.get("choices") or None,
        answer=answer,
        explanation=explanation,
    )


def _mix_learning_problem_sets(
    reused_problems: list[LearningProblemItem],
    ai_problems: list[LearningProblemItem],
) -> list[LearningProblemItem]:
    """
    재사용 1 : 신규 2 흐름을 최대한 유지하도록 두 목록을 섞습니다.
    """
    mixed: list[LearningProblemItem] = []
    reused_index = 0
    ai_index = 0

    while reused_index < len(reused_problems) or ai_index < len(ai_problems):
        if reused_index < len(reused_problems):
            mixed.append(reused_problems[reused_index])
            reused_index += 1

        for _ in range(2):
            if ai_index < len(ai_problems):
                mixed.append(ai_problems[ai_index])
                ai_index += 1

        if reused_index >= len(reused_problems) and ai_index < len(ai_problems):
            mixed.extend(ai_problems[ai_index:])
            break

        if ai_index >= len(ai_problems) and reused_index < len(reused_problems):
            mixed.extend(reused_problems[reused_index:])
            break

    return mixed


def _shuffle_problem_choices(problem: LearningProblemItem) -> LearningProblemItem:
    """
    객관식 선택지 순서를 섞어서 정답이 항상 1번에 고정되지 않도록 합니다.

    [중요]
    프론트는 정답 텍스트 자체를 기준으로 채점하므로,
    정답 문자열은 바꾸지 않고 보기 순서만 섞습니다.
    """
    if problem.type != "MULTIPLE" or not problem.choices or len(problem.choices) < 2:
        return problem

    if problem.answer not in problem.choices:
        return problem

    shuffled_choices = list(problem.choices)
    _RANDOM.shuffle(shuffled_choices)
    return problem.model_copy(update={"choices": shuffled_choices})


async def _store_generated_learning_problems(
    subject: str,
    difficulty: str,
    problems: list[LearningProblemItem],
) -> None:
    """
    새로 생성한 학습 문제를 출제 자산 컬렉션에 저장합니다.

    [개선]
    이전에는 문제마다 임베딩 API를 한 번씩 불렀지만,
    지금은 문제 목록을 한 번에 묶어서 배치 저장합니다.
    """
    if not problems:
        return

    try:
        await upsert_learning_problem_assets(
            [
                {
                    "subject_name": subject,
                    "difficulty": difficulty,
                    "problem_type": problem.type,
                    "question": problem.question,
                    "choices": problem.choices,
                    "answer": problem.answer,
                    "explanation": problem.explanation,
                }
                for problem in problems
            ]
        )
    except Exception:
        # 자산 저장이 실패해도 사용자 문제 생성 자체는 막지 않습니다.
        return


async def generate_problems(
    subject: str,
    difficulty: str,
    count: int,
    problem_type: str,
    user_accuracy: int | None = None,
) -> LearningProblemsResponse:
    """
    학습 문제를 혼합 출제 방식으로 생성합니다.

    [기본 정책]
    - 재사용 후보 1
    - AI 신규 생성 2
    - 단, 재사용 후보가 부족하면 신규 생성으로 보완
    """
    desired_reuse_count = count // 3

    try:
        reusable_assets = await search_learning_problem_assets(
            query=_build_learning_search_query(subject, difficulty, problem_type, user_accuracy),
            subject_name=subject,
            difficulty=difficulty,
            problem_type=problem_type if problem_type != "MIX" else None,
            limit=desired_reuse_count,
        )
        reused_problems = [
            problem
            for asset in reusable_assets
            if (problem := _build_reused_problem_item(asset["metadata"], problem_type)) is not None
        ]
    except Exception as reuse_error:
        logger.warning("학습 문제 재사용 검색 실패 (신규 생성으로 대체): %s", reuse_error)
        reused_problems = []

    ai_problems = await _generate_ai_problem_items(
        subject=subject,
        difficulty=difficulty,
        count=max(count - len(reused_problems), 0),
        problem_type=problem_type,
        user_accuracy=user_accuracy,
    )
    await _store_generated_learning_problems(subject, difficulty, ai_problems)

    mixed_problems = _mix_learning_problem_sets(reused_problems, ai_problems)[:count]

    return LearningProblemsResponse(
        problems=[_shuffle_problem_choices(problem) for problem in mixed_problems]
    )


async def grade_answer(
    question: str,
    correct_answer: str,
    user_answer: str,
    explanation: str,
) -> LearningGradeResponse:
    system_prompt = _load_prompt("learning_grade_system.txt")
    human_template = _load_prompt("learning_grade_human.txt")

    human_prompt = human_template.format(
        question=question,
        correct_answer=correct_answer,
        explanation=explanation or "(없음)",
        user_answer=user_answer,
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
            temperature=0.2,
            max_tokens=400,
            response_format={"type": "json_object"},
        )
        raw = response.choices[0].message.content.strip()
        data = json.loads(raw)
    except json.JSONDecodeError as error:
        raise HTTPException(status_code=502, detail=f"AI 응답 파싱 실패: {error}")
    except Exception as error:
        raise HTTPException(status_code=502, detail=f"AI 채점 실패: {error}")

    return LearningGradeResponse(
        isCorrect=bool(data.get("isCorrect", False)),
        aiFeedback=data.get("aiFeedback", ""),
    )
