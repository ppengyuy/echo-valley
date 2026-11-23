from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..core.deps import get_current_user
from ..core.response import ok
from ..database import get_db
from ..models.user import User
from ..schemas.echo import ManualSaveRequest, MirrorCreateRequest
from ..services import chat_service, echo_service

router = APIRouter(prefix="/echoes", tags=["echoes"])


@router.get("")
def list_echoes(
    status: Literal["active", "archived"] = Query(default="active"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    items = echo_service.list_echoes(db, user.id, status)
    # TODO: 语义连线生成；当前返回空列表
    return ok({"total": len(items), "items": items, "links": []})


@router.get("/stats")
def stats(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return ok(echo_service.stats(db, user.id))


@router.post("", status_code=201)
def save_echo(
    data: ManualSaveRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    message = chat_service.get_message(db, user.id, data.message_id)
    echo = echo_service.save_from_message(db, user.id, message, "manual_command")
    return ok({"echo": echo_service.echo_to_dict(echo)})


@router.post("/mirror", status_code=201)
def create_mirror(
    data: MirrorCreateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    message = chat_service.get_message(db, user.id, data.origin_message_id)
    origin, mirror = echo_service.create_mirror(db, user.id, message, data.mirror_content)
    return ok(
        {
            "origin_echo": echo_service.echo_to_dict(origin),
            "mirror_echo": echo_service.echo_to_dict(mirror),
            "confirm_required": True,
        }
    )


@router.post("/{echo_id}/archive")
def archive(
    echo_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    echo = echo_service.archive(db, user.id, echo_id)
    return ok({"echo": echo_service.echo_to_dict(echo)})


@router.post("/{echo_id}/restore")
def restore(
    echo_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    echo = echo_service.restore(db, user.id, echo_id)
    return ok({"echo": echo_service.echo_to_dict(echo)})


@router.delete("/{echo_id}")
def dissolve(
    echo_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    echo_service.dissolve(db, user.id, echo_id)
    return ok({"id": echo_id})


@router.delete("")
def clear(
    scope: Literal["all", "active", "archived"] = Query(default="all"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    deleted = echo_service.clear(db, user.id, scope)
    return ok({"deleted": deleted})
