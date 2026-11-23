from sqlalchemy.orm import Session

from ..core.exceptions import AppError
from ..core.security import hash_password, verify_password
from ..models.user import User, UserProfile
from ..schemas.auth import LoginRequest, RegisterRequest


def register(db: Session, data: RegisterRequest) -> User:
    exists = db.query(User).filter(User.username == data.username).first()
    if exists:
        raise AppError(40901, "用户名已存在", 409)
    user = User(
        username=data.username,
        password_hash=hash_password(data.password),
        nickname=data.nickname or data.username,
    )
    db.add(user)
    db.flush()
    db.add(UserProfile(user_id=user.id))
    db.commit()
    db.refresh(user)
    return user


def login(db: Session, data: LoginRequest) -> User:
    user = db.query(User).filter(User.username == data.username).first()
    if user is None or not verify_password(data.password, user.password_hash):
        raise AppError(40001, "用户名或密码错误", 400)
    return user
