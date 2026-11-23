from datetime import date, datetime, timedelta
import json

from sqlalchemy.orm import Session

from ..core.exceptions import AppError
from ..models.chat import ChatMessage, ChatSession
from ..models.echo import Echo
from ..utils.time import utcnow


def session_to_dict(session: ChatSession) -> dict:
    return {
        "id": session.id,
        "space": session.space,
        "title": session.title,
        "status": session.status,
        "created_at": session.created_at,
        "last_active_at": session.last_active_at,
    }


def message_to_dict(message: ChatMessage) -> dict:
    return {
        "id": message.id,
        "role": message.role,
        "content": message.content,
        "weather": message.weather,
        "save_inquiry": message.save_inquiry,
        "inquiry_category": message.inquiry_category,
        "mode": message.mode,
        "created_at": message.created_at,
    }


def create_session(db: Session, user_id: int, space: str, title: str) -> ChatSession:
    session = ChatSession(user_id=user_id, space=space, title=title)
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def list_sessions(
    db: Session, user_id: int, space: str | None, page: int, page_size: int
) -> tuple[int, list[ChatSession]]:
    query = db.query(ChatSession).filter(ChatSession.user_id == user_id)
    if space:
        query = query.filter(ChatSession.space == space)
    total = query.count()
    items = (
        query.order_by(ChatSession.last_active_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return total, items


def get_session(db: Session, user_id: int, session_id: int) -> ChatSession:
    session = db.get(ChatSession, session_id)
    if session is None:
        raise AppError(40401, "会话不存在", 404)
    if session.user_id != user_id:
        raise AppError(40301, "无权访问该会话", 403)
    return session


def get_message(db: Session, user_id: int, message_id: int) -> ChatMessage:
    message = db.get(ChatMessage, message_id)
    if message is None:
        raise AppError(40401, "消息不存在", 404)
    if message.user_id != user_id:
        raise AppError(40301, "无权访问该消息", 403)
    return message


def close_session(db: Session, user_id: int, session_id: int) -> ChatSession:
    session = get_session(db, user_id, session_id)
    session.status = "closed"
    db.commit()
    db.refresh(session)
    return session


def add_user_message(
    db: Session, session: ChatSession, content: str, mode: str
) -> ChatMessage:
    if session.status == "closed":
        raise AppError(40902, "会话已关闭", 409)
    message = ChatMessage(
        session_id=session.id,
        user_id=session.user_id,
        role="user",
        content=content,
        mode=mode,
    )
    db.add(message)
    session.last_active_at = utcnow()
    db.commit()
    db.refresh(message)
    return message


def add_assistant_message(
    db: Session, session: ChatSession, content: str, weather: str | None = None
) -> ChatMessage:
    message = ChatMessage(
        session_id=session.id,
        user_id=session.user_id,
        role="assistant",
        content=content,
        weather=weather,
    )
    db.add(message)
    session.last_active_at = utcnow()
    db.commit()
    db.refresh(message)
    return message


def history_for_llm(db: Session, session: ChatSession, limit: int = 20) -> list[dict]:
    rows = (
        db.query(ChatMessage)
        .filter(ChatMessage.session_id == session.id)
        .order_by(ChatMessage.id.desc())
        .limit(limit)
        .all()
    )
    rows.reverse()
    return [
        {"role": r.role, "content": r.content} for r in rows if r.role in ("user", "assistant")
    ]


# ---------------- 复盘唤起 ----------------

def pick_recall_echo(db: Session, user_id: int, exclude_ids: list[int] | None = None) -> Echo | None:
    """候选池：active 且 normal 的回音；演示版取最久远的一条。"""
    query = db.query(Echo).filter(
        Echo.user_id == user_id,
        Echo.status == "active",
        Echo.type == "normal",
    )
    if exclude_ids:
        query = query.filter(Echo.id.notin_(exclude_ids))
    return query.order_by(Echo.created_at.asc()).first()


def recall_text(echo: Echo) -> str:
    return (
        f"山谷为你带回一段你曾经留下的回音：「{echo.content}」。"
        "此刻再听见这句话，你有什么新的感受吗？"
    )
