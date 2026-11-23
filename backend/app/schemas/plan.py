from datetime import date
from typing import Literal

from pydantic import BaseModel, Field


class PlanCreate(BaseModel):
    final_goal: str = Field(min_length=1, max_length=100)
    deadline: date
    daily_hours: float = Field(ge=0.5, le=16)
    focus_minutes: int = Field(ge=15, le=120)
    rest_buffer_minutes: int = Field(default=15, ge=0, le=60)
    overpack_sensitivity: Literal["low", "normal", "high"] = "normal"
    weekly_rest_day: int = Field(default=6, ge=0, le=6)


class PlanUpdate(BaseModel):
    status: Literal["active", "archived"] | None = None
    daily_hours: float | None = Field(default=None, ge=0.5, le=16)
    weekly_rest_day: int | None = Field(default=None, ge=0, le=6)


class TaskUpdate(BaseModel):
    status: Literal["todo", "done", "skipped"]
