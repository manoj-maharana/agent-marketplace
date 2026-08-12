"""Recurrence math + execution for Tasks (see app/models.py:Task).

Recurrence is a simple named cadence ("once" | "daily" | "weekly"), not full
cron - it only needs to match what the UI's quick-create bar and templates
offer. Due tasks are checked lazily via POST /api/tasks/check-due, called by
the frontend whenever the Tasks page is open, rather than a server-side cron
job - see the model's docstring for why (no extra Azure infra needed for v1).
"""

from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.framework.agent import Agent as RuntimeAgent
from app.models import Task, TaskRun, utcnow


def compute_next_run(
    recurrence: str, recurrence_day: int | None, recurrence_hour: int, from_time: datetime
) -> datetime | None:
    """Returns the next UTC datetime this recurrence should fire at or after
    `from_time`, or None for "once" (a single manual/unscheduled task)."""
    hour = max(0, min(23, recurrence_hour))

    if recurrence == "daily":
        candidate = from_time.replace(hour=hour, minute=0, second=0, microsecond=0)
        if candidate <= from_time:
            candidate += timedelta(days=1)
        return candidate

    if recurrence == "weekly":
        target_day = recurrence_day if recurrence_day is not None else 0
        candidate = from_time.replace(hour=hour, minute=0, second=0, microsecond=0)
        candidate += timedelta(days=(target_day - candidate.weekday()) % 7)
        if candidate <= from_time:
            candidate += timedelta(days=7)
        return candidate

    return None  # "once"


async def run_task(task: Task) -> str:
    """Runs a task's assigned agent once against its title/description and
    returns the full reply text. Tasks with no agent assigned (plain
    checklist items created from the quick-create bar) are never scheduled
    in the first place, so this is only called for agent-backed tasks."""
    if not task.agent:
        return ""

    prompt = task.description.strip() or task.title
    runtime = RuntimeAgent.from_db(task.agent)
    text = ""
    async for event in runtime.stream([{"role": "user", "content": prompt}]):
        if event["type"] == "done":
            text = event["content"]
        elif event["type"] == "error":
            text = f"⚠️ {event['message']}"
    return text


async def check_and_run_due_tasks(db: AsyncSession) -> list[dict]:
    """Runs every active, agent-backed task whose next_run_at has passed,
    records a TaskRun for each, and reschedules them. Returns a summary of
    what ran, for the caller to report back to the client."""
    now = utcnow()
    stmt = select(Task).where(
        Task.is_active.is_(True),
        Task.agent_id.isnot(None),
        Task.next_run_at.isnot(None),
        Task.next_run_at <= now,
    )
    due = (await db.execute(stmt)).scalars().unique().all()

    ran = []
    for task in due:
        output = await run_task(task)
        db.add(TaskRun(task_id=task.id, output=output))
        task.last_run_at = now
        task.next_run_at = compute_next_run(task.recurrence, task.recurrence_day, task.recurrence_hour, now)
        ran.append({"task_id": task.id, "title": task.title})

    if due:
        await db.commit()
    return ran
