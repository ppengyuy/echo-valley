from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..config import settings
from ..core.deps import get_current_user
from ..core.response import ok
from ..core.security import create_access_token
from ..database import get_db
from ..models.user import User
from ..schemas.auth import LoginRequest, RegisterRequest
from ..schemas.user import UserOut
from ..services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


def _auth_data(user: User) -> dict:
    return {
        "user": UserOut.model_validate(user).model_dump(mode="json"),
        "access_token": create_access_token(user.id),
        "expires_in": settings.jwt_expire_days * 86400,
    }


@router.post("/register", status_code=201)
def register(data: RegisterRequest, db: Session = Depends(get_db)):
    user = auth_service.register(db, data)
    return ok(_auth_data(user))


@router.post("/login")
def login(data: LoginRequest, db: Session = Depends(get_db)):
    user = auth_service.login(db, data)
    return ok(_auth_data(user))


@router.get("/me")
def me(user: User = Depends(get_current_user)):
    return ok({"user": UserOut.model_validate(user).model_dump(mode="json")})
