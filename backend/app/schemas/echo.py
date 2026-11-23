from pydantic import BaseModel, Field


class ManualSaveRequest(BaseModel):
    message_id: int


class MirrorCreateRequest(BaseModel):
    origin_message_id: int
    mirror_content: str = Field(min_length=1, max_length=1000)
