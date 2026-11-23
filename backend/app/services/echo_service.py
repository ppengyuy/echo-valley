from sqlalchemy.orm import Session

from ..core.exceptions import AppError
from ..models.chat import ChatMessage
from ..models.echo import Echo
from ..utils.time import utcnow


def echo_to_dict(echo: Echo, pending: bool = False) -> dict:
    return {
        "id": echo.id,
        "type": echo.type,
        "content": echo.content,
        "status": echo.status,
        "source": echo.source,
        "mirror_of_id": echo.mirror_of_id,
        "created_at": echo.created_at,
        "archived_at": echo.archived_at,
        "pending_confirm": pending,
    }


def get_owned_echo(db: Session, user_id: int, echo_id: int) -> Echo:
    echo = db.get(Echo, echo_id)
    if echo is None:
        raise AppError(40401, "回音不存在", 404)
    if echo.user_id != user_id:
        raise AppError(40301, "无权访问该回音", 403)
    return echo


def save_from_message(
    db: Session, user_id: int, message: ChatMessage, source: str = "manual_command"
) -> Echo:
    if message.user_id != user_id:
        raise AppError(40301, "无权访问该消息", 403)
    if message.role != "user":
        raise AppError(40001, "只能保存用户消息", 400)
    if message.save_inquiry == "accepted":
        raise AppError(40902, "该消息已保存过", 409)
    echo = Echo(
        user_id=user_id,
        message_id=message.id,
        content=message.content,
        type="normal",
        source=source,
    )
    db.add(echo)
    message.save_inquiry = "accepted"
    db.commit()
    db.refresh(echo)
    return echo


def archive(db: Session, user_id: int, echo_id: int) -> Echo:
    echo = get_owned_echo(db, user_id, echo_id)
    if echo.status == "archived":
        raise AppError(40902, "回音已归档", 409)
    echo.status = "archived"
    echo.archived_at = utcnow()
    db.commit()
    db.refresh(echo)
    return echo


def restore(db: Session, user_id: int, echo_id: int) -> Echo:
    echo = get_owned_echo(db, user_id, echo_id)
    if echo.status == "active":
        raise AppError(40902, "回音未归档", 409)
    echo.status = "active"
    echo.archived_at = None
    db.commit()
    db.refresh(echo)
    return echo


def dissolve(db: Session, user_id: int, echo_id: int) -> None:
    echo = get_owned_echo(db, user_id, echo_id)
    # 先解除镜像回声的自引用，避免外键约束阻止删除
    db.query(Echo).filter(Echo.mirror_of_id == echo.id).update(
        {Echo.mirror_of_id: None}, synchronize_session=False
    )
    db.delete(echo)
    db.commit()


def clear(db: Session, user_id: int, scope: str = "all") -> int:
    query = db.query(Echo).filter(Echo.user_id == user_id)
    if scope in ("active", "archived"):
        query = query.filter(Echo.status == scope)
    ids = [row[0] for row in query.with_entities(Echo.id).all()]
    if not ids:
        return 0
    db.query(Echo).filter(Echo.mirror_of_id.in_(ids)).update(
        {Echo.mirror_of_id: None}, synchronize_session=False
    )
    deleted = (
        db.query(Echo)
        .filter(Echo.id.in_(ids))
        .delete(synchronize_session=False)
    )
    db.commit()
    return deleted


def create_mirror(
    db: Session, user_id: int, origin_message: ChatMessage, mirror_content: str
) -> tuple[Echo, Echo]:
    """成对创建：原回音 + 镜像回音；消息置 pending，由 save-decision 决定去留。"""
    if origin_message.user_id != user_id:
        raise AppError(40301, "无权访问该消息", 403)
    if origin_message.save_inquiry == "accepted":
        raise AppError(40902, "该消息已保存过", 409)
    origin = Echo(
        user_id=user_id,
        message_id=origin_message.id,
        content=origin_message.content,
        type="normal",
        source="mirror_flow",
    )
    db.add(origin)
    db.flush()
    mirror = Echo(
        user_id=user_id,
        message_id=origin_message.id,
        content=mirror_content,
        type="mirror",
        mirror_of_id=origin.id,
        source="mirror_flow",
    )
    db.add(mirror)
    origin_message.save_inquiry = "pending"
    origin_message.inquiry_category = "emotion"
    db.commit()
    db.refresh(origin)
    db.refresh(mirror)
    return origin, mirror


def discard_mirror(db: Session, user_id: int, message: ChatMessage) -> None:
    echoes = db.query(Echo).filter(
        Echo.user_id == user_id,
        Echo.message_id == message.id,
        Echo.source == "mirror_flow",
    ).all()
    ids = [echo.id for echo in echoes]
    if ids:
        db.query(Echo).filter(Echo.mirror_of_id.in_(ids)).update(
            {Echo.mirror_of_id: None}, synchronize_session=False
        )
        db.query(Echo).filter(Echo.id.in_(ids)).delete(synchronize_session=False)
    db.commit()


def list_echoes(db: Session, user_id: int, status: str) -> list[dict]:
    rows = (
        db.query(Echo)
        .filter(Echo.user_id == user_id, Echo.status == status)
        .order_by(Echo.created_at.desc())
        .all()
    )
    items = []
    for echo in rows:
        pending = False
        if echo.source == "mirror_flow" and echo.message_id:
            message = db.get(ChatMessage, echo.message_id)
            pending = bool(message and message.save_inquiry == "pending")
        items.append(echo_to_dict(echo, pending))
    return items


def stats(db: Session, user_id: int) -> dict:
    # 演示版：累计数按现存回音计（删除后回退）；正式版应加独立累计计数器
    total = db.query(Echo).filter(Echo.user_id == user_id).count()
    active = db.query(Echo).filter(Echo.user_id == user_id, Echo.status == "active").count()
    threshold = 5
    return {
        "total_saved": total,
        "active_count": active,
        "archived_count": total - active,
        "milestone": {
            "threshold": threshold,
            "reached": total >= threshold,
            "text": "你已经五次愿意停下来，听见自己。",
        },
    }
