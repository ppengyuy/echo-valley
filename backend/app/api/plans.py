import io

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from ..core.deps import get_current_user
from ..core.response import ok
from ..database import get_db
from ..models.user import User
from ..schemas.plan import PlanCreate, PlanUpdate, TaskUpdate
from ..services import plan_service

router = APIRouter(prefix="/plans", tags=["plans"])


@router.post("", status_code=201)
def create_plan(
    data: PlanCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    plan = plan_service.create_plan(db, user.id, data)
    return ok({"plan": plan_service.plan_to_dict(plan)})


@router.get("")
def list_plans(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    plans = plan_service.list_plans(db, user.id)
    return ok({"items": [plan_service.plan_to_dict(p) for p in plans]})


@router.get("/current")
def current_plan(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    plan = plan_service.get_active_plan(db, user.id)
    return ok({"plan": plan_service.plan_to_dict(plan) if plan else None})


@router.patch("/tasks/{task_id}")
def update_task(
    task_id: int,
    data: TaskUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    task = plan_service.update_task(db, user.id, task_id, data.status)
    return ok(
        {
            "task": {
                "id": task.id,
                "task_date": task.task_date,
                "content": task.content,
                "estimated_minutes": task.estimated_minutes,
                "status": task.status,
                "completed_at": task.completed_at,
            }
        }
    )


@router.get("/{plan_id}")
def get_plan(
    plan_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    plan = plan_service.get_plan(db, user.id, plan_id)
    return ok({"plan": plan_service.plan_to_dict(plan)})


@router.patch("/{plan_id}")
def update_plan(
    plan_id: int,
    data: PlanUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    plan, notice = plan_service.update_plan(
        db,
        user.id,
        plan_id,
        status=data.status,
        daily_hours=data.daily_hours,
        weekly_rest_day=data.weekly_rest_day,
    )
    result = {"plan": plan_service.plan_to_dict(plan)}
    if notice:
        result["notice"] = notice
    return ok(result)


@router.get("/{plan_id}/export")
def export_plan(
    plan_id: int,
    format: str = Query(default="csv", pattern="^(csv|excel)$"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    plan = plan_service.get_plan(db, user.id, plan_id)
    rows = plan_service.export_rows(plan)

    if format == "excel":
        from openpyxl import Workbook

        workbook = Workbook()
        sheet = workbook.active
        sheet.title = "学习计划"
        for row in rows:
            sheet.append(row)
        buffer = io.BytesIO()
        workbook.save(buffer)
        return Response(
            content=buffer.getvalue(),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": f"attachment; filename=plan_{plan.id}.xlsx"
            },
        )

    import csv

    text = io.StringIO()
    writer = csv.writer(text)
    writer.writerows(rows)
    return Response(
        content="\ufeff" + text.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename=plan_{plan.id}.csv"},
    )
