from datetime import date, datetime

from sqlalchemy import Date, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base
from ..utils.time import utcnow


class Plan(Base):
    __tablename__ = "plans"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    final_goal: Mapped[str] = mapped_column(Text)
    deadline: Mapped[date] = mapped_column(Date)
    daily_hours: Mapped[float] = mapped_column(Float)
    focus_minutes: Mapped[int] = mapped_column(Integer)
    rest_buffer_minutes: Mapped[int] = mapped_column(Integer, default=15)
    # low / normal / high
    overpack_sensitivity: Mapped[str] = mapped_column(String(10), default="normal")
    # 0=周一 ... 6=周日
    weekly_rest_day: Mapped[int] = mapped_column(Integer, default=6)
    # 超载删减说明（JSON 字符串），生成计划时写入
    trim_report: Mapped[str | None] = mapped_column(Text, nullable=True)
    # active / archived
    status: Mapped[str] = mapped_column(String(10), default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    milestones: Mapped[list["PlanMilestone"]] = relationship(
        back_populates="plan", cascade="all, delete-orphan", order_by="PlanMilestone.order_index"
    )
    tasks: Mapped[list["PlanDailyTask"]] = relationship(
        back_populates="plan", cascade="all, delete-orphan", order_by="PlanDailyTask.task_date"
    )


class PlanMilestone(Base):
    __tablename__ = "plan_milestones"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    plan_id: Mapped[int] = mapped_column(
        ForeignKey("plans.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(100))
    # year / month / week
    period: Mapped[str] = mapped_column(String(10))
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date] = mapped_column(Date)
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    # todo / done / adjusted
    status: Mapped[str] = mapped_column(String(10), default="todo")

    plan: Mapped[Plan] = relationship(back_populates="milestones")


class PlanDailyTask(Base):
    __tablename__ = "plan_daily_tasks"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    plan_id: Mapped[int] = mapped_column(
        ForeignKey("plans.id", ondelete="CASCADE"), index=True
    )
    milestone_id: Mapped[int | None] = mapped_column(
        ForeignKey("plan_milestones.id"), nullable=True
    )
    task_date: Mapped[date] = mapped_column(Date, index=True)
    content: Mapped[str] = mapped_column(Text)
    estimated_minutes: Mapped[int] = mapped_column(Integer)
    # todo / done / skipped
    status: Mapped[str] = mapped_column(String(10), default="todo")
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    plan: Mapped[Plan] = relationship(back_populates="tasks")
