from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class CategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    slug: str
    name: str
    kind: str


class SkillOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    slug: str
    name: str
    description: str
    icon: str
    is_functional: bool
    author: str
    source_url: str | None = None
    category: CategoryOut | None = None


class SkillListResponse(BaseModel):
    items: list[SkillOut]
    total: int
    page: int
    page_size: int


class AgentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    slug: str
    title: str
    description: str
    avatar_emoji: str
    avatar_color: str
    system_prompt: str
    tags: list[str]
    author: str
    is_installed: bool
    is_custom: bool
    model_deployment: str | None
    temperature: float
    install_count: int
    created_at: datetime
    updated_at: datetime
    category: CategoryOut | None = None
    skills: list[SkillOut] = Field(default_factory=list)


class AgentListResponse(BaseModel):
    items: list[AgentOut]
    total: int
    page: int
    page_size: int


class AgentCreate(BaseModel):
    title: str
    description: str = ""
    avatar_emoji: str = "🤖"
    avatar_color: str = "#6366f1"
    system_prompt: str = "You are a helpful assistant."
    category_slug: str | None = None
    tags: list[str] = Field(default_factory=list)
    temperature: float = 0.7
    skill_ids: list[int] = Field(default_factory=list)


class AgentUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    avatar_emoji: str | None = None
    avatar_color: str | None = None
    system_prompt: str | None = None
    category_slug: str | None = None
    tags: list[str] | None = None
    temperature: float | None = None
    skill_ids: list[int] | None = None


class AgentGroupMemberOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    position: int
    role_label: str | None
    agent: AgentOut


class AgentGroupOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str
    mode: str
    orchestrator_prompt: str
    iterations: int
    created_at: datetime
    updated_at: datetime
    members: list[AgentGroupMemberOut] = Field(default_factory=list)


class AgentGroupListResponse(BaseModel):
    items: list[AgentGroupOut]
    total: int


class AgentGroupMemberCreate(BaseModel):
    agent_id: int
    role_label: str | None = None


class AgentGroupCreate(BaseModel):
    name: str
    description: str = ""
    mode: str = "sequential"  # sequential | parallel | iterative | debate
    orchestrator_prompt: str = ""
    iterations: int = 2
    members: list[AgentGroupMemberCreate] = Field(default_factory=list)


class GroupRunRequest(BaseModel):
    message: str


class GroupContribution(BaseModel):
    agent_id: int
    agent_name: str
    role_label: str | None
    round: int  # 1 for single-pass modes; increments for "iterative"
    content: str


class GroupRunResponse(BaseModel):
    contributions: list[GroupContribution]
    summary: str


class McpServerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    slug: str
    name: str
    description: str
    icon: str
    author: str
    transport: str
    is_functional: bool
    install_count: int
    created_at: datetime
    category: CategoryOut | None = None


class McpServerListResponse(BaseModel):
    items: list[McpServerOut]
    total: int
    page: int
    page_size: int


class AssistantThreadOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    created_at: datetime
    updated_at: datetime


class AssistantThreadCreate(BaseModel):
    title: str | None = None


class AssistantMessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    thread_id: int
    role: str
    content: str
    routing: dict | None = None
    created_at: datetime


class AssistantMessageCreate(BaseModel):
    content: str


class TaskRunOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    output: str
    created_at: datetime


class TaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: str
    agent_id: int | None
    priority: str
    assignee: str | None
    is_private: bool
    recurrence: str
    recurrence_day: int | None
    recurrence_hour: int
    is_active: bool
    next_run_at: datetime | None
    last_run_at: datetime | None
    created_at: datetime
    updated_at: datetime
    agent: AgentOut | None = None


class TaskCreate(BaseModel):
    title: str
    description: str = ""
    agent_id: int | None = None
    priority: str = "none"  # none | low | medium | high
    assignee: str | None = None
    is_private: bool = False
    recurrence: str = "once"  # once | daily | weekly
    recurrence_day: int | None = None  # 0=Mon..6=Sun, weekly only
    recurrence_hour: int = 9  # 0-23 UTC


class TaskUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    agent_id: int | None = None
    priority: str | None = None
    assignee: str | None = None
    is_private: bool | None = None
    recurrence: str | None = None
    recurrence_day: int | None = None
    recurrence_hour: int | None = None
    is_active: bool | None = None


class ResourceOut(BaseModel):
    id: int
    filename: str
    content_type: str
    size_bytes: int
    is_processed: bool
    processing_error: str | None
    chunk_count: int
    attached_agent_ids: list[int] = Field(default_factory=list)
    created_at: datetime


class ResourceAttachRequest(BaseModel):
    agent_id: int


class ConversationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    agent_id: int
    title: str
    created_at: datetime
    updated_at: datetime
    agent: AgentOut


class ConversationCreate(BaseModel):
    agent_id: int
    title: str | None = None


class MessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    conversation_id: int
    role: str
    content: str
    tool_calls: list | None = None
    created_at: datetime


class MessageCreate(BaseModel):
    content: str
