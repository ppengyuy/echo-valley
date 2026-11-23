from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base
from ..utils.time import utcnow


class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    # valley 回音谷 / path 山间小路
    space: Mapped[str] = mapped_column(String(10), index=True)
    title: Mapped[str] = mapped_column(String(100), default="")
    # active / closed
    status: Mapped[str] = mapped_column(String(10), default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    last_active_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    messages: Mapped[list["ChatMessage"]] = relationship(
        back_populates="session", cascade="all, delete-orphan", order_by="ChatMessage.id"
    )


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("chat_sessions.id"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    # user / assistant
    role: Mapped[str] = mapped_column(String(10))
    content: Mapped[str] = mapped_column(Text)
    # mist / breeze / rain / clear（仅 assistant）
    weather: Mapped[str | None] = mapped_column(String(10), nullable=True)
    # none / pending / accepted / rejected（仅 user）
    save_inquiry: Mapped[str] = mapped_column(String(10), default="none")
    # emotion / reflection / reading_touch / belief
    inquiry_category: Mapped[str | None] = mapped_column(String(20), nullable=True)
    # chat / review
    mode: Mapped[str | None] = mapped_column(String(10), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    session: Mapped[ChatSession] = relationship(back_populates="messages")
