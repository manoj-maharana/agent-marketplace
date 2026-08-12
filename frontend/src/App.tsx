import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import { AgentDetail } from "@/pages/AgentDetail";
import { AgentGroupChat } from "@/pages/AgentGroupChat";
import { AgentGroups } from "@/pages/AgentGroups";
import { AgentMarketplace } from "@/pages/AgentMarketplace";
import { AssistantHome } from "@/pages/AssistantHome";
import { Chat } from "@/pages/Chat";
import { CreateAgent } from "@/pages/CreateAgent";
import { CreateAgentGroup } from "@/pages/CreateAgentGroup";
import { EditAgent } from "@/pages/EditAgent";
import { Home } from "@/pages/Home";
import { Landing } from "@/pages/Landing";
import { McpDetail } from "@/pages/McpDetail";
import { McpMarketplace } from "@/pages/McpMarketplace";
import { Resources } from "@/pages/Resources";
import { SkillMarketplace } from "@/pages/SkillMarketplace";
import { Tasks } from "@/pages/Tasks";

// These pages own their full-page layout (own sidebar or none at all) -
// they don't render inside the marketplace app shell below.
const STANDALONE_ROUTES = ["/", "/assistant", "/assistant/tasks", "/assistant/resources"];

export default function App() {
  const location = useLocation();

  if (STANDALONE_ROUTES.includes(location.pathname)) {
    return (
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/assistant" element={<AssistantHome />} />
        <Route path="/assistant/tasks" element={<Tasks />} />
        <Route path="/assistant/resources" element={<Resources />} />
      </Routes>
    );
  }

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-bg text-text">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="min-w-0 flex-1 overflow-hidden">
          <Routes>
            <Route path="/home" element={<Home />} />
            <Route path="/agents" element={<AgentMarketplace />} />
            <Route path="/agents/new" element={<CreateAgent />} />
            <Route path="/agents/:agentId/edit" element={<EditAgent />} />
            <Route path="/agents/:agentId" element={<AgentDetail />} />
            <Route path="/groups" element={<AgentGroups />} />
            <Route path="/groups/new" element={<CreateAgentGroup />} />
            <Route path="/groups/:groupId" element={<AgentGroupChat />} />
            <Route path="/skills" element={<SkillMarketplace />} />
            <Route path="/mcp" element={<McpMarketplace />} />
            <Route path="/mcp/:mcpId" element={<McpDetail />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/chat/:agentId" element={<Chat />} />
            <Route path="/chat/:agentId/:conversationId" element={<Chat />} />
            <Route path="*" element={<Navigate to="/home" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
