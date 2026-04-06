"""
출제 자산용 Vector DB 서비스

[역할]
기존 vector_service.py가 세션별 문서 RAG를 담당한다면,
이 파일은 AI가 생성한 학습 문제와 면접 질문을 영구 자산으로 저장하고
다음 생성 때 다시 검색해서 재사용하는 역할을 담당합니다.

[이번 보강]
- 배치 임베딩 저장 지원
- ChromaDB query 단계의 사전 필터 적용
"""

import json
import logging
import uuid
from typing import Any

from services.embedding_service import embed_texts
from services.vector_service import _get_client

logger = logging.getLogger(__name__)

LEARNING_PROBLEM_ASSET_COLLECTION = "learning_problem_assets"
INTERVIEW_QUESTION_ASSET_COLLECTION = "interview_question_assets"


def _get_asset_collection(collection_name: str):
    """
    영구 출제 자산 컬렉션을 가져오거나 새로 만듭니다.
    """
    client = _get_client()
    return client.get_or_create_collection(
        name=collection_name,
        metadata={"hnsw:space": "cosine"},
    )


def _serialize_metadata_value(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, (str, int, float, bool)):
        return value
    return json.dumps(value, ensure_ascii=False)


def _serialize_metadata(metadata: dict[str, Any]) -> dict[str, Any]:
    serialized: dict[str, Any] = {}
    for key, value in metadata.items():
        serialized_value = _serialize_metadata_value(value)
        if serialized_value is not None:
            serialized[key] = serialized_value
    return serialized


def _deserialize_json_list(value: Any) -> list[str]:
    if not value:
        return []
    if isinstance(value, list):
        return [str(item) for item in value]
    if not isinstance(value, str):
        return [str(value)]

    try:
        parsed = json.loads(value)
        if isinstance(parsed, list):
            return [str(item) for item in parsed]
    except json.JSONDecodeError:
        pass

    return [segment.strip() for segment in value.split("|") if segment.strip()]


def _build_where_filter(*, active: bool = True, **filters: Any) -> dict[str, Any] | None:
    """
    ChromaDB query 전에 먼저 적용할 사전 필터를 만듭니다.

    [의도]
    벡터 검색 결과를 넓게 가져온 뒤 Python에서만 걸러내면
    데이터가 늘수록 불필요한 후보를 너무 많이 읽게 됩니다.
    active, 과목, 난이도, 유형처럼 정확히 일치해야 하는 값은
    ChromaDB 쿼리 단계에서 먼저 줄여서 검색 비용과 후처리 비용을 같이 낮춥니다.
    """
    conditions: list[dict[str, Any]] = []

    if active is not None:
        conditions.append({"active": active})

    for key, value in filters.items():
        if value is None:
            continue
        conditions.append({key: value})

    if not conditions:
        return None
    if len(conditions) == 1:
        return conditions[0]
    return {"$and": conditions}


def _build_learning_problem_document(
    subject_name: str,
    difficulty: str,
    problem_type: str,
    question: str,
    choices: list[str] | None,
    answer: str,
    explanation: str,
    concept_tags: list[str] | None,
) -> str:
    choice_text = " | ".join(choices or [])
    concept_text = ", ".join(concept_tags or [])
    return "\n".join(
        filter(
            None,
            [
                f"과목: {subject_name}",
                f"난이도: {difficulty}",
                f"문제유형: {problem_type}",
                f"문제: {question}",
                f"선택지: {choice_text}" if choice_text else "",
                f"정답: {answer}",
                f"해설: {explanation}",
                f"개념태그: {concept_text}" if concept_text else "",
            ],
        )
    )


def _build_interview_question_document(
    job_family: str | None,
    question_type: str,
    difficulty: str | None,
    question: str,
    resume_keywords: list[str] | None,
    job_keywords: list[str] | None,
    context_summary: str | None,
) -> str:
    return "\n".join(
        filter(
            None,
            [
                f"직무군: {job_family}" if job_family else "",
                f"질문유형: {question_type}",
                f"난이도: {difficulty}" if difficulty else "",
                f"이력서 키워드: {', '.join(resume_keywords or [])}" if resume_keywords else "",
                f"채용공고 키워드: {', '.join(job_keywords or [])}" if job_keywords else "",
                f"문맥 요약: {context_summary}" if context_summary else "",
                f"질문: {question}",
            ],
        )
    )


async def upsert_learning_problem_asset(
    subject_name: str,
    difficulty: str,
    problem_type: str,
    question: str,
    answer: str,
    explanation: str,
    *,
    asset_id: str | None = None,
    subject_id: int | None = None,
    choices: list[str] | None = None,
    concept_tags: list[str] | None = None,
    source: str = "ai_generated",
    quality_score: int = 70,
) -> str:
    """
    학습 문제 1건 저장용 래퍼입니다.
    내부에서는 배치 저장 함수를 재사용합니다.
    """
    return (
        await upsert_learning_problem_assets(
            [
                {
                    "asset_id": asset_id,
                    "subject_id": subject_id,
                    "subject_name": subject_name,
                    "difficulty": difficulty,
                    "problem_type": problem_type,
                    "question": question,
                    "choices": choices,
                    "answer": answer,
                    "explanation": explanation,
                    "concept_tags": concept_tags,
                    "source": source,
                    "quality_score": quality_score,
                }
            ]
        )
    )[0]


async def upsert_learning_problem_assets(items: list[dict[str, Any]]) -> list[str]:
    """
    학습 문제 자산을 한 번에 배치 임베딩해서 저장합니다.

    [의도]
    문제를 여러 개 저장할 때마다 OpenAI 임베딩을 단건 호출하면
    호출 수가 불필요하게 늘고 속도와 비용이 같이 나빠집니다.
    그래서 문서 문자열을 먼저 모은 뒤 한 번의 임베딩 요청으로 묶습니다.
    """
    if not items:
        return []

    asset_ids: list[str] = []
    documents: list[str] = []
    metadatas: list[dict[str, Any]] = []

    for item in items:
        effective_asset_id = str(item.get("asset_id") or f"learning_problem_{uuid.uuid4().hex}")
        document = _build_learning_problem_document(
            subject_name=str(item["subject_name"]),
            difficulty=str(item["difficulty"]),
            problem_type=str(item["problem_type"]),
            question=str(item["question"]),
            choices=item.get("choices"),
            answer=str(item["answer"]),
            explanation=str(item["explanation"]),
            concept_tags=item.get("concept_tags"),
        )
        metadata = _serialize_metadata(
            {
                "asset_id": effective_asset_id,
                "asset_type": "learning_problem",
                "subject_id": item.get("subject_id"),
                "subject_name": item.get("subject_name"),
                "difficulty": item.get("difficulty"),
                "problem_type": item.get("problem_type"),
                "question_text": item.get("question"),
                "answer_text": item.get("answer"),
                "explanation_text": item.get("explanation"),
                "choices": item.get("choices") or [],
                "concept_tags": item.get("concept_tags") or [],
                "source": item.get("source", "ai_generated"),
                "quality_score": item.get("quality_score", 70),
                "reuse_count": 0,
                "active": True,
                "language": "ko",
            }
        )
        asset_ids.append(effective_asset_id)
        documents.append(document)
        metadatas.append(metadata)

    embeddings = await embed_texts(documents)
    _get_asset_collection(LEARNING_PROBLEM_ASSET_COLLECTION).upsert(
        ids=asset_ids,
        documents=documents,
        embeddings=embeddings,
        metadatas=metadatas,
    )
    logger.info("학습 문제 자산 배치 저장 완료: count=%d", len(asset_ids))
    return asset_ids


async def upsert_interview_question_asset(
    question_type: str,
    question: str,
    *,
    asset_id: str | None = None,
    job_family: str | None = None,
    difficulty: str | None = None,
    resume_keywords: list[str] | None = None,
    job_keywords: list[str] | None = None,
    context_summary: str | None = None,
    conversation_stage: str | None = None,
    source: str = "ai_generated",
    quality_score: int = 70,
) -> str:
    """
    면접 질문 1건 저장용 래퍼입니다.
    내부에서는 배치 저장 함수를 재사용합니다.
    """
    return (
        await upsert_interview_question_assets(
            [
                {
                    "asset_id": asset_id,
                    "job_family": job_family,
                    "question_type": question_type,
                    "difficulty": difficulty,
                    "question": question,
                    "resume_keywords": resume_keywords,
                    "job_keywords": job_keywords,
                    "context_summary": context_summary,
                    "conversation_stage": conversation_stage,
                    "source": source,
                    "quality_score": quality_score,
                }
            ]
        )
    )[0]


async def upsert_interview_question_assets(items: list[dict[str, Any]]) -> list[str]:
    """
    면접 질문 자산을 한 번에 배치 임베딩해서 저장합니다.
    """
    if not items:
        return []

    asset_ids: list[str] = []
    documents: list[str] = []
    metadatas: list[dict[str, Any]] = []

    for item in items:
        effective_asset_id = str(item.get("asset_id") or f"interview_question_{uuid.uuid4().hex}")
        document = _build_interview_question_document(
            job_family=item.get("job_family"),
            question_type=str(item["question_type"]),
            difficulty=item.get("difficulty"),
            question=str(item["question"]),
            resume_keywords=item.get("resume_keywords"),
            job_keywords=item.get("job_keywords"),
            context_summary=item.get("context_summary"),
        )
        metadata = _serialize_metadata(
            {
                "asset_id": effective_asset_id,
                "asset_type": "interview_question",
                "job_family": item.get("job_family"),
                "question_type": item.get("question_type"),
                "difficulty": item.get("difficulty"),
                "question_text": item.get("question"),
                "resume_keywords": item.get("resume_keywords") or [],
                "job_keywords": item.get("job_keywords") or [],
                "context_summary": item.get("context_summary"),
                "conversation_stage": item.get("conversation_stage"),
                "source": item.get("source", "ai_generated"),
                "quality_score": item.get("quality_score", 70),
                "reuse_count": 0,
                "active": True,
                "language": "ko",
            }
        )
        asset_ids.append(effective_asset_id)
        documents.append(document)
        metadatas.append(metadata)

    embeddings = await embed_texts(documents)
    _get_asset_collection(INTERVIEW_QUESTION_ASSET_COLLECTION).upsert(
        ids=asset_ids,
        documents=documents,
        embeddings=embeddings,
        metadatas=metadatas,
    )
    logger.info("면접 질문 자산 배치 저장 완료: count=%d", len(asset_ids))
    return asset_ids


def _build_result_items(
    ids: list[str],
    documents: list[str],
    metadatas: list[dict[str, Any]],
    distances: list[float] | None,
) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    for index, asset_id in enumerate(ids):
        metadata = dict(metadatas[index] or {})
        metadata["choices"] = _deserialize_json_list(metadata.get("choices"))
        metadata["concept_tags"] = _deserialize_json_list(metadata.get("concept_tags"))
        metadata["resume_keywords"] = _deserialize_json_list(metadata.get("resume_keywords"))
        metadata["job_keywords"] = _deserialize_json_list(metadata.get("job_keywords"))
        items.append(
            {
                "id": asset_id,
                "document": documents[index] if index < len(documents) else "",
                "metadata": metadata,
                "distance": distances[index] if distances and index < len(distances) else None,
            }
        )
    return items


async def search_learning_problem_assets(
    query: str,
    *,
    subject_name: str | None = None,
    difficulty: str | None = None,
    problem_type: str | None = None,
    limit: int = 5,
    exclude_ids: list[str] | None = None,
) -> list[dict[str, Any]]:
    """
    학습 문제 자산 컬렉션에서 유사한 문제를 검색합니다.
    """
    collection = _get_asset_collection(LEARNING_PROBLEM_ASSET_COLLECTION)
    if collection.count() == 0:
        return []

    query_embedding = await embed_texts([query])
    where_filter = _build_where_filter(
        subject_name=subject_name,
        difficulty=difficulty,
        problem_type=problem_type,
    )
    result = collection.query(
        query_embeddings=query_embedding,
        n_results=min(max(limit * 3, limit), collection.count()),
        where=where_filter,
        include=["documents", "metadatas", "distances"],
    )

    exclude_id_set = set(exclude_ids or [])
    items = _build_result_items(
        ids=result.get("ids", [[]])[0],
        documents=result.get("documents", [[]])[0],
        metadatas=result.get("metadatas", [[]])[0],
        distances=result.get("distances", [[]])[0] if result.get("distances") else None,
    )

    filtered: list[dict[str, Any]] = []
    for item in items:
        metadata = item["metadata"]
        if item["id"] in exclude_id_set:
            continue
        if metadata.get("active") is False:
            continue
        if subject_name and metadata.get("subject_name") != subject_name:
            continue
        if difficulty and metadata.get("difficulty") != difficulty:
            continue
        if problem_type and metadata.get("problem_type") != problem_type:
            continue
        filtered.append(item)
        if len(filtered) >= limit:
            break
    return filtered


async def search_interview_question_assets(
    query: str,
    *,
    question_type: str | None = None,
    job_family: str | None = None,
    limit: int = 3,
    exclude_ids: list[str] | None = None,
) -> list[dict[str, Any]]:
    """
    면접 질문 자산 컬렉션에서 유사한 질문을 검색합니다.
    """
    collection = _get_asset_collection(INTERVIEW_QUESTION_ASSET_COLLECTION)
    if collection.count() == 0:
        return []

    query_embedding = await embed_texts([query])
    where_filter = _build_where_filter(
        question_type=question_type,
        job_family=job_family,
    )
    result = collection.query(
        query_embeddings=query_embedding,
        n_results=min(max(limit * 3, limit), collection.count()),
        where=where_filter,
        include=["documents", "metadatas", "distances"],
    )

    exclude_id_set = set(exclude_ids or [])
    items = _build_result_items(
        ids=result.get("ids", [[]])[0],
        documents=result.get("documents", [[]])[0],
        metadatas=result.get("metadatas", [[]])[0],
        distances=result.get("distances", [[]])[0] if result.get("distances") else None,
    )

    filtered: list[dict[str, Any]] = []
    for item in items:
        metadata = item["metadata"]
        if item["id"] in exclude_id_set:
            continue
        if metadata.get("active") is False:
            continue
        if question_type and metadata.get("question_type") != question_type:
            continue
        if job_family and metadata.get("job_family") != job_family:
            continue
        filtered.append(item)
        if len(filtered) >= limit:
            break
    return filtered
