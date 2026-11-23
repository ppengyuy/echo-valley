from pydantic import BaseModel, Field, field_validator
import re

from .user import UserOut


class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=20)
    password: str = Field(min_length=8, max_length=64)
    nickname: str | None = Field(default=None, max_length=50)

    @field_validator("username")
    @classmethod
    def validate_username(cls, value: str) -> str:
        if not re.fullmatch(r"[A-Za-z0-9_]+", value):
            raise ValueError("用户名只能包含字母、数字、下划线")
        return value


class LoginRequest(BaseModel):
    username: str
    password: str


class AuthData(BaseModel):
    user: UserOut
    access_token: str
    expires_in: int
