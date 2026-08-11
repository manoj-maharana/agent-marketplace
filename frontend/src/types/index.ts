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

export interface KnowledgeFile {
  id: number;
  filename: string;
  chunk_count: number;
  created_at: string;
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
