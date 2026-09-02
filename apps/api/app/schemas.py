from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models import Language, TaskPriority, TaskStatus


class TelegramAuthRequest(BaseModel):
    init_data: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    telegram_id: int
    username: str | None
    first_name: str | None
    language: Language
    timezone: str
    daily_digest_hour: int


class UserUpdate(BaseModel):
    language: Language | None = None
    timezone: str | None = Field(default=None, max_length=64)
    daily_digest_hour: int | None = Field(default=None, ge=0, le=23)


class CategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    color: str = Field(default="#22c55e", pattern=r"^#[0-9a-fA-F]{6}$")


class CategoryRead(CategoryCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int


class TaskBase(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    description: str | None = None
    priority: TaskPriority = TaskPriority.medium
    due_at: datetime | None = None
    remind_at: datetime | None = None
    recurrence: str | None = Field(default=None, max_length=100)
    category_id: int | None = None


class TaskCreate(TaskBase):
    pass


class TaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=300)
    description: str | None = None
    status: TaskStatus | None = None
    priority: TaskPriority | None = None
    due_at: datetime | None = None
    remind_at: datetime | None = None
    recurrence: str | None = Field(default=None, max_length=100)
    category_id: int | None = None


class TaskRead(TaskBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    status: TaskStatus
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime


class TaskList(BaseModel):
    items: list[TaskRead]
    total: int


class DashboardStats(BaseModel):
    pending: int
    completed_today: int
    overdue: int
    completion_rate: int
