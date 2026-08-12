from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.framework.task_scheduler import check_and_run_due_tasks, compute_next_run, run_task
from app.models import Agent, Task, TaskRun, utcnow
from app.schemas import TaskCreate, TaskOut, TaskRunOut, TaskUpdate

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


def _recompute_next_run(task: Task) -> None:
    if task.agent_id and task.recurrence != "once":
        task.next_run_at = compute_next_run(task.recurrence, task.recurrence_day, task.recurrence_hour, utcnow())
    else:
        task.next_run_at = None


@router.get("", response_model=list[TaskOut])
async def list_tasks(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Task).order_by(Task.created_at.desc()))
    return result.scalars().unique().all()


@router.post("", response_model=TaskOut, status_code=201)
async def create_task(payload: TaskCreate, db: AsyncSession = Depends(get_db)):
    if payload.agent_id is not None and not await db.get(Agent, payload.agent_id):
        raise HTTPException(status_code=400, detail="Agent not found")

    task = Task(
        title=payload.title,
        description=payload.description,
        agent_id=payload.agent_id,
        priority=payload.priority,
        assignee=payload.assignee,
        is_private=payload.is_private,
        recurrence=payload.recurrence,
        recurrence_day=payload.recurrence_day,
        recurrence_hour=payload.recurrence_hour,
    )
    _recompute_next_run(task)
    db.add(task)
    await db.commit()
    await db.refresh(task, attribute_names=["agent"])
    return task


@router.patch("/{task_id}", response_model=TaskOut)
async def update_task(task_id: int, payload: TaskUpdate, db: AsyncSession = Depends(get_db)):
    task = await db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(task, field, value)
    if {"agent_id", "recurrence", "recurrence_day", "recurrence_hour"} & data.keys():
        _recompute_next_run(task)

    await db.commit()
    await db.refresh(task, attribute_names=["agent"])
    return task


@router.delete("/{task_id}", status_code=204)
async def delete_task(task_id: int, db: AsyncSession = Depends(get_db)):
    task = await db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    await db.delete(task)
    await db.commit()


@router.get("/{task_id}/runs", response_model=list[TaskRunOut])
async def list_task_runs(task_id: int, db: AsyncSession = Depends(get_db)):
    task = await db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    result = await db.execute(
        select(TaskRun).where(TaskRun.task_id == task_id).order_by(TaskRun.created_at.desc())
    )
    return result.scalars().all()


@router.post("/{task_id}/run-now", response_model=TaskRunOut, status_code=201)
async def run_task_now(task_id: int, db: AsyncSession = Depends(get_db)):
    task = await db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if not task.agent_id:
        raise HTTPException(status_code=400, detail="This task has no agent assigned to run it")

    output = await run_task(task)
    run = TaskRun(task_id=task.id, output=output)
    db.add(run)
    task.last_run_at = utcnow()
    await db.commit()
    await db.refresh(run)
    return run


@router.post("/check-due")
async def check_due(db: AsyncSession = Depends(get_db)):
    ran = await check_and_run_due_tasks(db)
    return {"ran": ran}
