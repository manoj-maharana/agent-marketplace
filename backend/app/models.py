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


class KnowledgeFile(Base):
    __tablename__ = "knowledge_files"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    agent_id: Mapped[int] = mapped_column(ForeignKey("agents.id", ondelete="CASCADE"), index=True)
    filename: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    chunks: Mapped[list["KnowledgeChunk"]] = relationship(
        back_populates="file", cascade="all, delete-orphan", lazy="selectin"
    )


class KnowledgeChunk(Base):
    __tablename__ = "knowledge_chunks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    file_id: Mapped[int] = mapped_column(
        ForeignKey("knowledge_files.id", ondelete="CASCADE"), index=True
    )
    agent_id: Mapped[int] = mapped_column(ForeignKey("agents.id", ondelete="CASCADE"), index=True)
    chunk_index: Mapped[int] = mapped_column(Integer)
    content: Mapped[str] = mapped_column(Text)
    embedding: Mapped[list[float]] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    file: Mapped[KnowledgeFile] = relationship(back_populates="chunks")
