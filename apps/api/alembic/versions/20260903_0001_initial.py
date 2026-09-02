"""Initial TaskPilot schema."""

import sqlalchemy as sa

from alembic import op

revision = "20260903_0001"
down_revision = None
branch_labels = None
depends_on = None

language = sa.Enum("ru", "en", name="language")
task_status = sa.Enum("pending", "completed", "archived", name="taskstatus")
task_priority = sa.Enum("low", "medium", "high", name="taskpriority")


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("telegram_id", sa.BigInteger(), nullable=False, unique=True),
        sa.Column("username", sa.String(64)),
        sa.Column("first_name", sa.String(128)),
        sa.Column("language", language, nullable=False),
        sa.Column("timezone", sa.String(64), nullable=False),
        sa.Column("daily_digest_hour", sa.Integer(), nullable=False),
        sa.Column("last_digest_date", sa.Date()),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_users_telegram_id", "users", ["telegram_id"], unique=True)
    op.create_table(
        "categories",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "owner_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("name", sa.String(80), nullable=False),
        sa.Column("color", sa.String(16), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_categories_owner_id", "categories", ["owner_id"])
    op.create_table(
        "tasks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "owner_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("category_id", sa.Integer(), sa.ForeignKey("categories.id", ondelete="SET NULL")),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("status", task_status, nullable=False),
        sa.Column("priority", task_priority, nullable=False),
        sa.Column("due_at", sa.DateTime(timezone=True)),
        sa.Column("remind_at", sa.DateTime(timezone=True)),
        sa.Column("reminder_sent_at", sa.DateTime(timezone=True)),
        sa.Column("recurrence", sa.String(100)),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_tasks_owner_id", "tasks", ["owner_id"])
    op.create_index("ix_tasks_status", "tasks", ["status"])
    op.create_index("ix_tasks_due_at", "tasks", ["due_at"])
    op.create_index("ix_tasks_remind_at", "tasks", ["remind_at"])
    op.create_index("ix_tasks_owner_status_due", "tasks", ["owner_id", "status", "due_at"])
    op.create_index("ix_tasks_pending_reminder", "tasks", ["reminder_sent_at", "remind_at"])


def downgrade() -> None:
    op.drop_table("tasks")
    op.drop_table("categories")
    op.drop_table("users")
    task_priority.drop(op.get_bind())
    task_status.drop(op.get_bind())
    language.drop(op.get_bind())
