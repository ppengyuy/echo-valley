from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..core.deps import get_current_user
from ..core.response import ok
from ..database import get_db
from ..models.user import User
from ..services import review_service

router = APIRouter(prefix="/review", tags=["review"])


@router.get("/summary")
def summary(
    days: int = Query(default=14, ge=1, le=90),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return ok(review_service.summary(db, user.id, days))
