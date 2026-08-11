import { Navigate, Route, Routes } from "react-router-dom";
import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import { AgentDetail } from "@/pages/AgentDetail";
import { AgentGroupChat } from "@/pages/AgentGroupChat";
import { AgentGroups } from "@/pages/AgentGroups";
import { AgentMarketplace } from "@/pages/AgentMarketplace";
import { Chat } from "@/pages/Chat";
import { CreateAgent } from "@/pages/CreateAgent";
import { CreateAgentGroup } from "@/pages/CreateAgentGroup";
import { EditAgent } from "@/pages/EditAgent";
import { Home } from "@/pages/Home";
import { McpDetail } from "@/pages/McpDetail";
import { McpMarketplace } from "@/pages/McpMarketplace";
import { SkillMarketplace } from "@/pages/SkillMarketplace";

export default function App() {
  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-bg text-text">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="min-w-0 flex-1 overflow-hidden">
          <Routes>
            <Route path="/" element={<Navigate to="/home" replace />} />
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
