from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..core.deps import get_current_user
from ..core.exceptions import AppError
from ..core.response import ok
from ..database import get_db
from ..models.user import User, UserFact, UserProfile
from ..schemas.profile import ProfileUpdate

router = APIRouter(prefix="/profile", tags=["profile"])


def _get_or_create_profile(db: Session, user_id: int) -> UserProfile:
    profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
    if profile is None:
        profile = UserProfile(user_id=user_id)
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return profile


@router.get("")
def get_profile(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    profile = _get_or_create_profile(db, user.id)
    return ok(
        {
            "profile": {
                "exam_type": profile.exam_type,
                "target_desc": profile.target_desc,
                "updated_at": profile.updated_at,
            }
        }
    )


@router.patch("")
def update_profile(
    data: ProfileUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = _get_or_create_profile(db, user.id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(profile, field, value)
    db.commit()
    db.refresh(profile)
    return ok(
        {
            "profile": {
                "exam_type": profile.exam_type,
                "target_desc": profile.target_desc,
                "updated_at": profile.updated_at,
            }
        }
    )


@router.get("/facts")
def list_facts(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    facts = (
        db.query(UserFact)
        .filter(UserFact.user_id == user.id)
        .order_by(UserFact.told_at.desc())
        .all()
    )
    return ok(
        {
            "facts": [
                {
                    "id": fact.id,
                    "content": fact.content,
                    "told_at": fact.told_at,
                    "status": fact.status,
                }
                for fact in facts
            ]
        }
    )


@router.delete("/facts/{fact_id}")
def delete_fact(
    fact_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    fact = db.get(UserFact, fact_id)
    if fact is None:
        raise AppError(40401, "记忆条目不存在", 404)
    if fact.user_id != user.id:
        raise AppError(40301, "无权删除该记忆", 403)
    fact.status = "removed"
    db.commit()
    return ok({"id": fact.id})
