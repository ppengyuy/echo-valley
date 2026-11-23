import calendar
from datetime import date, timedelta
import json

from sqlalchemy.orm import Session

from ..core.exceptions import AppError
from ..models.plan import Plan, PlanDailyTask, PlanMilestone
from ..schemas.plan import PlanCreate
from ..utils.time import utcnow


def _month_end(d: date) -> date:
    return date(d.year, d.month, calendar.monthrange(d.year, d.month)[1])


def _next_month(d: date) -> date:
    if d.month == 12:
        return date(d.year + 1, 1, 1)
    return date(d.year, d.month + 1, 1)


def create_plan(db: Session, user_id: int, data: PlanCreate) -> Plan:
    today = date.today()
    if data.deadline <= today:
        raise AppError(40001, "截止日期必须晚于今天", 400)
    active = (
        db.query(Plan)
        .filter(Plan.user_id == user_id, Plan.status == "active")
        .first()
    )
    if active is not None:
        raise AppError(40902, "已有进行中的计划，请先归档旧计划", 409)

    # TODO: 接入 LLM 辅助拆解；当前为确定性规则：按月切阶段、按日铺任务
    plan = Plan(
        user_id=user_id,
        final_goal=data.final_goal,
        deadline=data.deadline,
        daily_hours=data.daily_hours,
        focus_minutes=data.focus_minutes,
        rest_buffer_minutes=data.rest_buffer_minutes,
        overpack_sensitivity=data.overpack_sensitivity,
        weekly_rest_day=data.weekly_rest_day,
    )
    db.add(plan)
    db.flush()

    milestones: list[PlanMilestone] = []
    cursor = today
    order = 1
    while cursor <= data.deadline and len(milestones) < 36:
        end = min(_month_end(cursor), data.deadline)
        milestone = PlanMilestone(
            plan_id=plan.id,
            title=f"{cursor.year}年{cursor.month}月：推进 {data.final_goal}",
            period="month",
            start_date=cursor,
            end_date=end,
            order_index=order,
        )
        db.add(milestone)
        milestones.append(milestone)
        order += 1
        cursor = _next_month(cursor)

    db.flush()
    # 每日任务：跳过缓冲日；预估时长为每日可用时长的 60%，留出缓冲
    task_minutes = max(15, int(data.daily_hours * 60 * 0.6))
    day = today
    while day <= data.deadline:
        if day.weekday() != data.weekly_rest_day:
            milestone = next((m for m in milestones if m.start_date <= day <= m.end_date), None)
            if milestone is not None:
                db.add(
                    PlanDailyTask(
                        plan_id=plan.id,
                        milestone_id=milestone.id,
                        task_date=day,
                        content=f"推进：{milestone.title}",
                        estimated_minutes=task_minutes,
                    )
                )
        day += timedelta(days=1)

    # TODO: 真正的超载删减与删减说明；当前规则下不会超载
    plan.trim_report = json.dumps({"trimmed": [], "reason": ""}, ensure_ascii=False)
    db.commit()
    db.refresh(plan)
    return plan


def get_active_plan(db: Session, user_id: int) -> Plan | None:
    return (
        db.query(Plan)
        .filter(Plan.user_id == user_id, Plan.status == "active")
        .first()
    )


def get_plan(db: Session, user_id: int, plan_id: int) -> Plan:
    plan = db.get(Plan, plan_id)
    if plan is None:
        raise AppError(40401, "计划不存在", 404)
    if plan.user_id != user_id:
        raise AppError(40301, "无权访问该计划", 403)
    return plan


def list_plans(db: Session, user_id: int) -> list[Plan]:
    return (
        db.query(Plan)
        .filter(Plan.user_id == user_id)
        .order_by(Plan.created_at.desc())
        .all()
    )


def plan_to_dict(plan: Plan) -> dict:
    trim_report = None
    if plan.trim_report:
        try:
            trim_report = json.loads(plan.trim_report)
        except json.JSONDecodeError:
            trim_report = plan.trim_report
    return {
        "id": plan.id,
        "final_goal": plan.final_goal,
        "deadline": plan.deadline,
        "daily_hours": plan.daily_hours,
        "focus_minutes": plan.focus_minutes,
        "rest_buffer_minutes": plan.rest_buffer_minutes,
        "overpack_sensitivity": plan.overpack_sensitivity,
        "weekly_rest_day": plan.weekly_rest_day,
        "trim_report": trim_report,
        "status": plan.status,
        "created_at": plan.created_at,
        "milestones": [
            {
                "id": m.id,
                "title": m.title,
                "period": m.period,
                "start_date": m.start_date,
                "end_date": m.end_date,
                "order_index": m.order_index,
                "status": m.status,
                "tasks": [
                    {
                        "id": t.id,
                        "task_date": t.task_date,
                        "content": t.content,
                        "estimated_minutes": t.estimated_minutes,
                        "status": t.status,
                        "completed_at": t.completed_at,
                    }
                    for t in sorted(
                        (t for t in plan.tasks if t.milestone_id == m.id),
                        key=lambda t: t.task_date,
                    )
                ],
            }
            for m in sorted(plan.milestones, key=lambda m: m.order_index)
        ],
    }


def update_plan(db: Session, user_id: int, plan_id: int, *, status=None, daily_hours=None, weekly_rest_day=None) -> tuple[Plan, str | None]:
    plan = get_plan(db, user_id, plan_id)
    notice = None
    if daily_hours is not None and daily_hours != plan.daily_hours:
        plan.daily_hours = daily_hours
        notice = "时长已更新，建议重新生成计划"
    if weekly_rest_day is not None:
        plan.weekly_rest_day = weekly_rest_day
    if status is not None:
        plan.status = status
    db.commit()
    db.refresh(plan)
    return plan, notice


def update_task(db: Session, user_id: int, task_id: int, status: str) -> PlanDailyTask:
    task = db.get(PlanDailyTask, task_id)
    if task is None:
        raise AppError(40401, "任务不存在", 404)
    plan = db.get(Plan, task.plan_id)
    if plan is None or plan.user_id != user_id:
        raise AppError(40301, "无权访问该任务", 403)
    task.status = status
    task.completed_at = utcnow() if status == "done" else None
    db.commit()
    db.refresh(task)
    # 阶段任务全部完成时自动标记 done
    if task.milestone_id:
        siblings = (
            db.query(PlanDailyTask)
            .filter(PlanDailyTask.milestone_id == task.milestone_id)
            .all()
        )
        milestone = db.get(PlanMilestone, task.milestone_id)
        if milestone and siblings and all(t.status == "done" for t in siblings):
            milestone.status = "done"
            db.commit()
    return task


def export_rows(plan: Plan) -> list[list]:
    rows = [["日期", "星期", "阶段", "任务内容", "预估时长(分钟)", "状态"]]
    weekdays = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"]
    status_map = {"todo": "待完成", "done": "已完成", "skipped": "已跳过"}
    milestone_map = {m.id: m.title for m in plan.milestones}
    for task in sorted(plan.tasks, key=lambda t: t.task_date):
        rows.append(
            [
                task.task_date.isoformat(),
                weekdays[task.task_date.weekday()],
                milestone_map.get(task.milestone_id, ""),
                task.content,
                task.estimated_minutes,
                status_map.get(task.status, task.status),
            ]
        )
    return rows
