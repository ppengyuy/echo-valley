from datetime import date, datetime, time, timedelta

from sqlalchemy.orm import Session

from ..models.echo import Echo
from ..models.plan import PlanDailyTask, Plan


def summary(db: Session, user_id: int, days: int) -> dict:
    since = datetime.combine(date.today() - timedelta(days=days - 1), time.min)

    plan = (
        db.query(Plan)
        .filter(Plan.user_id == user_id, Plan.status == "active")
        .first()
    )

    tasks_total = 0
    tasks_done = 0
    tasks_skipped = 0
    recent_tasks = []
    if plan is not None:
        tasks = (
            db.query(PlanDailyTask)
            .filter(
                PlanDailyTask.plan_id == plan.id,
                PlanDailyTask.task_date >= since.date(),
            )
            .all()
        )
        tasks_total = len(tasks)
        tasks_done = sum(1 for t in tasks if t.status == "done")
        tasks_skipped = sum(1 for t in tasks if t.status == "skipped")
        recent_tasks = [
            {"task_date": t.task_date, "content": t.content, "status": t.status}
            for t in sorted(tasks, key=lambda t: t.task_date, reverse=True)[:10]
        ]

    echoes = (
        db.query(Echo)
        .filter(
            Echo.user_id == user_id,
            Echo.status == "active",
            Echo.created_at >= since,
        )
        .order_by(Echo.created_at.desc())
        .all()
    )

    return {
        "path": {
            "plan_id": plan.id if plan else None,
            "final_goal": plan.final_goal if plan else None,
            "window_days": days,
            "tasks_total": tasks_total,
            "tasks_done": tasks_done,
            "tasks_skipped": tasks_skipped,
            "recent_tasks": recent_tasks,
        },
        "valley": {
            "echoes_total": len(echoes),
            "recent_echoes": [
                {"id": e.id, "content": e.content, "created_at": e.created_at}
                for e in echoes
            ],
        },
    }
