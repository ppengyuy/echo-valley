from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base
from ..utils.time import utcnow


class Echo(Base):
    __tablename__ = "echoes"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    message_id: Mapped[int | None] = mapped_column(
        ForeignKey("chat_messages.id"), nullable=True
    )
    # 用户原话，写入后永不修改
    content: Mapped[str] = mapped_column(Text)
    # normal / mirror
    type: Mapped[str] = mapped_column(String(10), default="normal")
    mirror_of_id: Mapped[int | None] = mapped_column(ForeignKey("echoes.id"), nullable=True)
    # auto_confirm / manual_command / mirror_flow
    source: Mapped[str] = mapped_column(String(20))
    # active / archived
    status: Mapped[str] = mapped_column(String(10), default="active", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    archived_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class EchoLink(Base):
    __tablename__ = "echo_links"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    echo_a_id: Mapped[int] = mapped_column(ForeignKey("echoes.id", ondelete="CASCADE"))
    echo_b_id: Mapped[int] = mapped_column(ForeignKey("echoes.id", ondelete="CASCADE"))
    # resonance / growth / contrast
    relation_type: Mapped[str] = mapped_column(String(20))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
