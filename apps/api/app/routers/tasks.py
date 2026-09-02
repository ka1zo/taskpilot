from datetime import UTC, datetime, time

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import case, func, select

from app.dependencies import CurrentUser, SessionDep
from app.models import Task, TaskStatus
from app.schemas import DashboardStats, TaskCreate, TaskList, TaskRead, TaskUpdate

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.get("", response_model=TaskList)
async def list_tasks(
    current_user: CurrentUser,
    session: SessionDep,
    task_status: TaskStatus | None = Query(default=None, alias="status"),
    due_before: datetime | None = None,
    search: str | None = Query(default=None, max_length=100),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> TaskList:
    filters = [Task.owner_id == current_user.id]
    if task_status:
        filters.append(Task.status == task_status)
    if due_before:
        filters.append(Task.due_at <= due_before)
    if search:
        filters.append(Task.title.ilike(f"%{search}%"))

    total = await session.scalar(select(func.count(Task.id)).where(*filters)) or 0
    result = await session.scalars(
        select(Task)
        .where(*filters)
        .order_by(
            case((Task.status == TaskStatus.completed, 1), else_=0),
            Task.due_at.asc().nullslast(),
            Task.created_at.desc(),
        )
        .limit(limit)
        .offset(offset)
    )
    return TaskList(items=[TaskRead.model_validate(item) for item in result], total=total)


@router.post("", response_model=TaskRead, status_code=status.HTTP_201_CREATED)
async def create_task(payload: TaskCreate, current_user: CurrentUser, session: SessionDep) -> Task:
    task = Task(owner_id=current_user.id, **payload.model_dump())
    session.add(task)
    await session.commit()
    await session.refresh(task)
    return task


async def owned_task(task_id: int, owner_id: int, session: SessionDep) -> Task:
    task = await session.scalar(select(Task).where(Task.id == task_id, Task.owner_id == owner_id))
    if task is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Task not found")
    return task


@router.get("/{task_id}", response_model=TaskRead)
async def read_task(task_id: int, current_user: CurrentUser, session: SessionDep) -> Task:
    return await owned_task(task_id, current_user.id, session)


@router.patch("/{task_id}", response_model=TaskRead)
async def update_task(
    task_id: int, payload: TaskUpdate, current_user: CurrentUser, session: SessionDep
) -> Task:
    task = await owned_task(task_id, current_user.id, session)
    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(task, field, value)
    if "status" in updates:
        task.completed_at = datetime.now(UTC) if task.status == TaskStatus.completed else None
    if "remind_at" in updates:
        task.reminder_sent_at = None
    await session.commit()
    await session.refresh(task)
    return task


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(task_id: int, current_user: CurrentUser, session: SessionDep) -> None:
    task = await owned_task(task_id, current_user.id, session)
    await session.delete(task)
    await session.commit()


@router.get("/dashboard/stats", response_model=DashboardStats)
async def dashboard_stats(current_user: CurrentUser, session: SessionDep) -> DashboardStats:
    now = datetime.now(UTC)
    day_start = datetime.combine(now.date(), time.min, tzinfo=UTC)
    pending = (
        await session.scalar(
            select(func.count(Task.id)).where(
                Task.owner_id == current_user.id, Task.status == TaskStatus.pending
            )
        )
        or 0
    )
    completed_today = (
        await session.scalar(
            select(func.count(Task.id)).where(
                Task.owner_id == current_user.id,
                Task.status == TaskStatus.completed,
                Task.completed_at >= day_start,
            )
        )
        or 0
    )
    overdue = (
        await session.scalar(
            select(func.count(Task.id)).where(
                Task.owner_id == current_user.id,
                Task.status == TaskStatus.pending,
                Task.due_at < now,
            )
        )
        or 0
    )
    total = pending + completed_today
    rate = round(completed_today / total * 100) if total else 0
    return DashboardStats(
        pending=pending, completed_today=completed_today, overdue=overdue, completion_rate=rate
    )
