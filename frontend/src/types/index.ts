export interface Category {
  id: number;
  slug: string;
  name: string;
  kind: "agent" | "skill" | "mcp";
}

export interface McpServer {
  id: number;
  slug: string;
  name: string;
  description: string;
  icon: string;
  author: string;
  transport: "local" | "remote" | "hybrid";
  is_functional: boolean;
  install_count: number;
  created_at: string;
  category: Category | null;
}

export interface McpServerListResponse {
  items: McpServer[];
  total: number;
  page: number;
  page_size: number;
}

export interface Skill {
  id: number;
  slug: string;
  name: string;
  description: string;
  icon: string;
  is_functional: boolean;
  author: string;
  source_url: string | null;
  category: Category | null;
}

export interface SkillListResponse {
  items: Skill[];
  total: number;
  page: number;
  page_size: number;
}

export interface Agent {
  id: number;
  slug: string;
  title: string;
  description: string;
  avatar_emoji: string;
  avatar_color: string;
  system_prompt: string;
  tags: string[];
  author: string;
  is_installed: boolean;
  is_custom: boolean;
  model_deployment: string | null;
  temperature: number;
  install_count: number;
  created_at: string;
  updated_at: string;
  category: Category | null;
  skills: Skill[];
}

export interface AgentListResponse {
  items: Agent[];
  total: number;
  page: number;
  page_size: number;
}

export interface AgentCreatePayload {
  title: string;
  description?: string;
  avatar_emoji?: string;
  avatar_color?: string;
  system_prompt?: string;
  category_slug?: string | null;
  tags?: string[];
  temperature?: number;
  skill_ids?: number[];
}

export interface AgentUpdatePayload {
  title?: string;
  description?: string;
  avatar_emoji?: string;
  avatar_color?: string;
  system_prompt?: string;
  category_slug?: string | null;
  tags?: string[];
  temperature?: number;
  skill_ids?: number[];
}

export interface Conversation {
  id: number;
  agent_id: number;
  title: string;
  created_at: string;
  updated_at: string;
  agent: Agent;
}

export interface Message {
  id: number;
  conversation_id: number;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  tool_calls: unknown[] | null;
  created_at: string;
}

export type StreamEvent =
  | { type: "token"; content: string }
  | { type: "tool_call"; name: string; arguments: Record<string, unknown> }
  | { type: "tool_result"; name: string; result: Record<string, unknown> }
  | { type: "done"; content: string }
  | { type: "error"; message: string };

export type TaskPriority = "none" | "low" | "medium" | "high";
export type TaskRecurrence = "once" | "daily" | "weekly";

export interface TaskRun {
  id: number;
  output: string;
  created_at: string;
}

export interface Task {
  id: number;
  title: string;
  description: string;
  agent_id: number | null;
  priority: TaskPriority;
  assignee: string | null;
  is_private: boolean;
  recurrence: TaskRecurrence;
  recurrence_day: number | null;
  recurrence_hour: number;
  is_active: boolean;
  next_run_at: string | null;
  last_run_at: string | null;
  created_at: string;
  updated_at: string;
  agent: Agent | null;
}

export interface TaskCreatePayload {
  title: string;
  description?: string;
  agent_id?: number | null;
  priority?: TaskPriority;
  assignee?: string | null;
  is_private?: boolean;
  recurrence?: TaskRecurrence;
  recurrence_day?: number | null;
  recurrence_hour?: number;
}

export interface TaskUpdatePayload {
  title?: string;
  description?: string;
  agent_id?: number | null;
  priority?: TaskPriority;
  assignee?: string | null;
  is_private?: boolean;
  recurrence?: TaskRecurrence;
  recurrence_day?: number | null;
  recurrence_hour?: number;
  is_active?: boolean;
}

export interface Resource {
  id: number;
  filename: string;
  content_type: string;
  size_bytes: number;
  is_processed: boolean;
  processing_error: string | null;
  chunk_count: number;
  attached_agent_ids: number[];
  created_at: string;
}

export interface AssistantThread {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface AssistantRoutingContribution {
  agent_id: number;
  agent_title: string;
  content: string;
}

export interface AssistantRouting {
  mode: "single" | "parallel" | "sequential";
  contributions: AssistantRoutingContribution[];
}

export interface AssistantMessage {
  id: number;
  thread_id: number;
  role: "user" | "assistant";
  content: string;
  routing: AssistantRouting | null;
  created_at: string;
}

export type AssistantStreamEvent =
  | {
      type: "route";
      mode: "single" | "parallel" | "sequential";
      agents: { id: number; title: string }[];
      reason: string;
    }
  | { type: "agent_start"; agent_id: number; agent_title: string }
  | { type: "agent_token"; agent_id: number; content: string }
  | { type: "agent_done"; agent_id: number; content: string }
  | { type: "token"; content: string }
  | { type: "done"; content: string; routing?: AssistantRouting }
  | { type: "error"; message: string };

export type AgentGroupMode = "sequential" | "parallel" | "iterative" | "debate";

export interface AgentGroupMember {
  id: number;
  position: number;
  role_label: string | null;
  agent: Agent;
}

export interface AgentGroup {
  id: number;
  name: string;
  description: string;
  mode: AgentGroupMode;
  orchestrator_prompt: string;
  iterations: number;
  created_at: string;
  updated_at: string;
  members: AgentGroupMember[];
}

export interface AgentGroupListResponse {
  items: AgentGroup[];
  total: number;
}

export interface AgentGroupMemberCreatePayload {
  agent_id: number;
  role_label?: string | null;
}

export interface AgentGroupCreatePayload {
  name: string;
  description?: string;
  mode: AgentGroupMode;
  orchestrator_prompt?: string;
  iterations?: number;
  members: AgentGroupMemberCreatePayload[];
}

export interface GroupContribution {
  agent_id: number;
  agent_name: string;
  role_label: string | null;
  round: number;
  content: string;
}

export interface GroupRunResponse {
  contributions: GroupContribution[];
  summary: string;
}
