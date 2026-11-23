from typing import Literal

from pydantic import BaseModel, Field


class SessionCreate(BaseModel):
    space: Literal["valley", "path"]
    title: str = Field(default="", max_length=100)


class SessionClose(BaseModel):
    status: Literal["closed"] = "closed"


class MessageCreate(BaseModel):
    content: str = Field(min_length=1, max_length=2000)
    mode: Literal["chat", "review"] = "chat"


class SaveDecision(BaseModel):
    decision: Literal["accept", "reject"]
