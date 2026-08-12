from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Table, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


agent_skill = Table(
    "agent_skill",
    Base.metadata,
    Column("agent_id", ForeignKey("agents.id", ondelete="CASCADE"), primary_key=True),
    Column("skill_id", ForeignKey("skills.id", ondelete="CASCADE"), primary_key=True),
)


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    slug: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(128))
    kind: Mapped[str] = mapped_column(String(16), index=True)  # "agent" | "skill"


class Agent(Base):
    __tablename__ = "agents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    slug: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")
    avatar_emoji: Mapped[str] = mapped_column(String(16), default="🤖")
    avatar_color: Mapped[str] = mapped_column(String(32), default="#6366f1")
    system_prompt: Mapped[str] = mapped_column(Text, default="You are a helpful assistant.")
    category_id: Mapped[int | None] = mapped_column(ForeignKey("categories.id"), nullable=True)
    tags: Mapped[list[str]] = mapped_column(JSON, default=list)
    author: Mapped[str] = mapped_column(String(120), default="Agent Marketplace")
    is_installed: Mapped[bool] = mapped_column(Boolean, default=False)
    is_custom: Mapped[bool] = mapped_column(Boolean, default=False)
    model_deployment: Mapped[str | None] = mapped_column(String(120), nullable=True)
    temperature: Mapped[float] = mapped_column(Float, default=0.7)
    install_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    category: Mapped[Category | None] = relationship(lazy="joined")
    skills: Mapped[list["Skill"]] = relationship(secondary=agent_skill, lazy="selectin")


class Skill(Base):
    __tablename__ = "skills"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    slug: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")
    icon: Mapped[str] = mapped_column(String(16), default="✨")
    category_id: Mapped[int | None] = mapped_column(ForeignKey("categories.id"), nullable=True)
    tool_key: Mapped[str | None] = mapped_column(String(64), nullable=True)
    input_schema: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    is_functional: Mapped[bool] = mapped_column(Boolean, default=False)
    author: Mapped[str] = mapped_column(String(120), default="Agent Marketplace")
    source_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    category: Mapped[Category | None] = relationship(lazy="joined")


class McpServer(Base):
    __tablename__ = "mcp_servers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    slug: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")
    icon: Mapped[str] = mapped_column(String(16), default="🔌")
    category_id: Mapped[int | None] = mapped_column(ForeignKey("categories.id"), nullable=True)
    author: Mapped[str] = mapped_column(String(120), default="Agent Marketplace")
    transport: Mapped[str] = mapped_column(String(32), default="local")  # local | remote | hybrid
    is_functional: Mapped[bool] = mapped_column(Boolean, default=False)
    install_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    category: Mapped[Category | None] = relationship(lazy="joined")


class AgentGroup(Base):
    """A team of Agents that collaborate on a single turn under one of four
    modes (see app/framework/agent_group_runner.py): sequential, parallel,
    iterative, or debate. Every group has a built-in Orchestrator - not a
    member agent, just a model + prompt - that kicks off the run and
    synthesizes the members' contributions into a final summary."""

    __tablename__ = "agent_groups"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")
    mode: Mapped[str] = mapped_column(String(16))  # sequential | parallel | iterative | debate
    orchestrator_prompt: Mapped[str] = mapped_column(Text, default="")
    orchestrator_model_deployment: Mapped[str | None] = mapped_column(String(120), nullable=True)
    iterations: Mapped[int] = mapped_column(Integer, default=2)  # only used by "iterative"
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    members: Mapped[list["AgentGroupMember"]] = relationship(
        back_populates="group",
        cascade="all, delete-orphan",
        order_by="AgentGroupMember.position",
        lazy="selectin",
    )


class AgentGroupMember(Base):
    __tablename__ = "agent_group_members"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    group_id: Mapped[int] = mapped_column(ForeignKey("agent_groups.id", ondelete="CASCADE"), index=True)
    agent_id: Mapped[int] = mapped_column(ForeignKey("agents.id", ondelete="CASCADE"))
    position: Mapped[int] = mapped_column(Integer, default=0)  # execution order (sequential/iterative)
    # Debate-mode framing, e.g. "advocate" | "critic" | "analyst". Unused by other modes.
    role_label: Mapped[str | None] = mapped_column(String(64), nullable=True)

    group: Mapped[AgentGroup] = relationship(back_populates="members")
    agent: Mapped[Agent] = relationship(lazy="joined")


class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    agent_id: Mapped[int] = mapped_column(ForeignKey("agents.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(200), default="New conversation")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    agent: Mapped[Agent] = relationship(lazy="joined")


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    conversation_id: Mapped[int] = mapped_column(
        ForeignKey("conversations.id", ondelete="CASCADE"), index=True
    )
    role: Mapped[str] = mapped_column(String(16))  # system | user | assistant | tool
    content: Mapped[str] = mapped_column(Text, default="")
    tool_calls: Mapped[list | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class AssistantThread(Base):
    """A conversation with the Assistant router (see app/framework/assistant_router.py),
    distinct from a single-agent Conversation: each turn here can fan out to
    one or more library agents chosen by an LLM routing pass, run them
    sequentially/parallel/single, and (for multi-agent turns) synthesize a
    final answer. Kept as its own table rather than reusing Conversation so
    the existing single-agent chat path stays untouched."""

    __tablename__ = "assistant_threads"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(200), default="New thread")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    messages: Mapped[list["AssistantMessage"]] = relationship(
        back_populates="thread",
        cascade="all, delete-orphan",
        order_by="AssistantMessage.created_at",
        lazy="selectin",
    )


class AssistantMessage(Base):
    __tablename__ = "assistant_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    thread_id: Mapped[int] = mapped_column(
        ForeignKey("assistant_threads.id", ondelete="CASCADE"), index=True
    )
    role: Mapped[str] = mapped_column(String(16))  # user | assistant
    content: Mapped[str] = mapped_column(Text, default="")
    # For assistant messages: the routing decision + each delegated agent's own
    # contribution, e.g. [{"agent_id":7,"agent_title":"...","content":"..."}].
    # Null for user messages and for single-agent turns with nothing to record beyond content.
    routing: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    thread: Mapped[AssistantThread] = relationship(back_populates="messages")


class Task(Base):
    """A to-do, one-off or recurring. Recurrence is a simple named cadence
    (not full cron) - "once" | "daily" | "weekly" - matched to what the UI's
    quick-create bar and templates offer. Due tasks are run lazily: the
    frontend calls POST /api/tasks/check-due whenever the Tasks page is open
    (see app/framework/task_scheduler.py) rather than a server-side cron job,
    so a task only actually fires while someone has the app open at/after its
    due time - documented in README.md as a v1 tradeoff."""

    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")
    agent_id: Mapped[int | None] = mapped_column(ForeignKey("agents.id", ondelete="SET NULL"), nullable=True)
    priority: Mapped[str] = mapped_column(String(16), default="none")  # none | low | medium | high
    assignee: Mapped[str | None] = mapped_column(String(120), nullable=True)
    is_private: Mapped[bool] = mapped_column(Boolean, default=False)
    recurrence: Mapped[str] = mapped_column(String(16), default="once")  # once | daily | weekly
    recurrence_day: Mapped[int | None] = mapped_column(Integer, nullable=True)  # 0=Mon..6=Sun; weekly only
    recurrence_hour: Mapped[int] = mapped_column(Integer, default=9)  # 0-23 UTC hour to fire at
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    next_run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    agent: Mapped[Agent | None] = relationship(lazy="joined")
    runs: Mapped[list["TaskRun"]] = relationship(
        back_populates="task",
        cascade="all, delete-orphan",
        order_by="TaskRun.created_at.desc()",
        lazy="selectin",
    )


class TaskRun(Base):
    __tablename__ = "task_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id", ondelete="CASCADE"), index=True)
    output: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    task: Mapped[Task] = relationship(back_populates="runs")


class Resource(Base):
    """A workspace-level file (PDF/Word/PPT/Excel/Markdown/text/CSV), stored as
    a raw blob in Azure Blob Storage. Anyone in the workspace can see and
    download it, and it can be attached (ResourceAgent, below) to any number
    of agents for RAG - one upload, reusable across agents, rather than the
    old per-agent-only Knowledge feature this replaces. Attaching a resource
    triggers extraction + chunking + embedding (ResourceChunk) the first time;
    is_processed/processing_error track that."""

    __tablename__ = "resources"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    filename: Mapped[str] = mapped_column(String(255))
    content_type: Mapped[str] = mapped_column(String(120), default="application/octet-stream")
    size_bytes: Mapped[int] = mapped_column(Integer, default=0)
    blob_name: Mapped[str] = mapped_column(String(255), unique=True)
    is_processed: Mapped[bool] = mapped_column(Boolean, default=False)
    processing_error: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    chunks: Mapped[list["ResourceChunk"]] = relationship(
        back_populates="resource", cascade="all, delete-orphan", lazy="selectin"
    )
    agent_links: Mapped[list["ResourceAgent"]] = relationship(
        back_populates="resource", cascade="all, delete-orphan", lazy="selectin"
    )


class ResourceChunk(Base):
    __tablename__ = "resource_chunks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    resource_id: Mapped[int] = mapped_column(ForeignKey("resources.id", ondelete="CASCADE"), index=True)
    chunk_index: Mapped[int] = mapped_column(Integer)
    content: Mapped[str] = mapped_column(Text)
    # Portable canonical storage (works on SQLite and Postgres alike). On
    # Postgres, app/framework/vector_search.py also mirrors this into a real
    # pgvector column via raw SQL for genuine ANN search - see that module's
    # docstring for why it's raw SQL rather than a mapped column here.
    embedding: Mapped[list[float]] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    resource: Mapped[Resource] = relationship(back_populates="chunks")


class ResourceAgent(Base):
    """Many-to-many: which agents a resource is attached to for RAG."""

    __tablename__ = "resource_agents"

    resource_id: Mapped[int] = mapped_column(
        ForeignKey("resources.id", ondelete="CASCADE"), primary_key=True
    )
    agent_id: Mapped[int] = mapped_column(ForeignKey("agents.id", ondelete="CASCADE"), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    resource: Mapped[Resource] = relationship(back_populates="agent_links")
    agent: Mapped["Agent"] = relationship(lazy="joined")
