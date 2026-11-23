from pydantic import BaseModel, Field


class ProfileUpdate(BaseModel):
    exam_type: str | None = Field(default=None, max_length=50)
    target_desc: str | None = Field(default=None, max_length=200)
