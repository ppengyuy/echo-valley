import json

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from ..core.deps import get_current_user
from ..core.exceptions import AppError
from ..core.response import ok
from ..database import get_db
from ..models.echo import Echo
from ..models.user import User
from ..schemas.chat import MessageCreate, SaveDecision, SessionClose, SessionCreate
from ..services import chat_service, chat_stream, echo_service

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("/sessions", status_code=201)
def create_session(
    data: SessionCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = chat_service.create_session(db, user.id, data.space, data.title)
    return ok({"session": chat_service.session_to_dict(session)})


@router.get("/sessions")
def list_sessions(
    space: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=50),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    total, items = chat_service.list_sessions(db, user.id, space, page, page_size)
    return ok(
        {
            "total": total,
            "items": [chat_service.session_to_dict(s) for s in items],
        }
    )


@router.get("/sessions/{session_id}")
def get_session(
    session_id: int,
    include: str | None = Query(default=None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = chat_service.get_session(db, user.id, session_id)
    data: dict = {"session": chat_service.session_to_dict(session)}
    if include == "messages":
        data["messages"] = [chat_service.message_to_dict(m) for m in session.messages]
    return ok(data)


@router.patch("/sessions/{session_id}")
def close_session(
    session_id: int,
    data: SessionClose,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = chat_service.close_session(db, user.id, session_id)
    return ok({"session": chat_service.session_to_dict(session)})


@router.post("/sessions/{session_id}/messages")
async def send_message(
    session_id: int,
    data: MessageCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = chat_service.get_session(db, user.id, session_id)

    async def event_stream():
        async for name, payload in chat_stream.stream_events(
            db, session, data.content, data.mode
        ):
            yield (
                f"event: {name}\n"
                f"data: {json.dumps(payload, ensure_ascii=False, default=str)}\n\n"
            )

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/messages/{message_id}/save-decision")
def save_decision(
    message_id: int,
    data: SaveDecision,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    message = chat_service.get_message(db, user.id, message_id)
    if message.save_inquiry != "pending":
        raise AppError(40902, "该消息没有待决定的存档询问", 409)

    if data.decision == "reject":
        echo_service.discard_mirror(db, user.id, message)
        message.save_inquiry = "rejected"
        db.commit()
        return ok({"echo": None})

    existing = (
        db.query(Echo)
        .filter(Echo.user_id == user.id, Echo.message_id == message.id)
        .first()
    )
    if existing is not None:
        message.save_inquiry = "accepted"
        db.commit()
        echo = existing
    else:
        echo = echo_service.save_from_message(db, user.id, message, "auto_confirm")
    return ok({"echo": echo_service.echo_to_dict(echo)})


@router.post("/messages/{message_id}/manual-save", status_code=201)
def manual_save(
    message_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    message = chat_service.get_message(db, user.id, message_id)
    echo = echo_service.save_from_message(db, user.id, message, "manual_command")
    return ok({"echo": echo_service.echo_to_dict(echo)})
