"""对话 SSE 流水线：落库 -> 安全兜底 -> 生成（流式）-> 存档询问 TODO。"""

from typing import AsyncIterator

from sqlalchemy.orm import Session

from ..ai import classifier, client, safety
from ..ai.prompts import BOUNDARY_REPLY, REVIEW_HINT, SAFETY_REPLY, SYSTEM_PROMPT
from ..config import settings
from ..models.chat import ChatSession
from . import chat_service

PLACEHOLDER_REPLY = "我在，慢慢说。山谷会安静地接住你的话。（AI 服务未配置，当前为占位回复）"


def _event(name: str, payload: dict) -> tuple[str, dict]:
    return name, payload


async def stream_events(
    db: Session,
    session: ChatSession,
    content: str,
    mode: str,
) -> AsyncIterator[tuple[str, dict]]:
    user_message = chat_service.add_user_message(db, session, content, mode)
    yield _event("user_message", chat_service.message_to_dict(user_message))

    # 1. 安全兜底（最高优先级）
    if safety.is_danger(content):
        assistant = chat_service.add_assistant_message(db, session, SAFETY_REPLY)
        yield _event(
            "safety_alert",
            {
                "level": "danger",
                "content": SAFETY_REPLY,
                "contact_hint": "学校心理中心 / 24小时心理援助热线 12356",
            },
        )
        yield _event("message", chat_service.message_to_dict(assistant))
        yield _event("done", {"session_id": session.id})
        return

    # 2. 越界拒答（不做题）
    if safety.is_quiz(content):
        assistant = chat_service.add_assistant_message(db, session, BOUNDARY_REPLY)
        yield _event("boundary_notice", {"content": BOUNDARY_REPLY})
        yield _event("message", chat_service.message_to_dict(assistant))
        yield _event("done", {"session_id": session.id})
        return

    # 3. 复盘模式：先文本带回一条旧回音
    recall = None
    if mode == "review":
        recall = chat_service.pick_recall_echo(db, session.user_id)
        if recall is not None:
            yield _event(
                "recall",
                {
                    "echo": {
                        "id": recall.id,
                        "content": recall.content,
                        "created_at": recall.created_at,
                    }
                },
            )

    # 4. 生成回复（LLM 未配置时走占位）
    history = chat_service.history_for_llm(db, session)
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    if mode == "review":
        messages.append({"role": "system", "content": REVIEW_HINT})
    messages.extend(history)

    parts: list[str] = []
    if settings.llm_enabled:
        try:
            async for delta in client.stream_chat(messages):
                parts.append(delta)
                yield _event("delta", {"text": delta})
        except Exception:
            parts = []
    if not parts:
        if mode == "review" and recall is not None:
            text = chat_service.recall_text(recall)
        else:
            text = PLACEHOLDER_REPLY
        parts.append(text)
        yield _event("delta", {"text": text})

    assistant = chat_service.add_assistant_message(db, session, "".join(parts))
    yield _event("message", chat_service.message_to_dict(assistant))

    # 5. TODO: 接入 classifier 结构化判定后，按需推送 save_inquiry / mirror_offer
    result = classifier.classify(content)
    if result["should_inquire"] and mode != "review":
        user_message.save_inquiry = "pending"
        user_message.inquiry_category = result["inquiry_category"]
        db.commit()
        yield _event(
            "save_inquiry",
            {
                "message_id": user_message.id,
                "category": result["inquiry_category"],
                "hint": "这句话听起来对你很重要，要不要存入山谷？",
            },
        )

    yield _event("done", {"session_id": session.id})
