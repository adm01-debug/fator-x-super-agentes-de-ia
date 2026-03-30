import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout/AppLayout";
import DashboardPage from "./pages/DashboardPage";
import AgentsPage from "./pages/AgentsPage";
import AgentDetailPage from "./pages/AgentDetailPage";
import CreateAgentPage from "./pages/CreateAgentPage";
import KnowledgePage from "./pages/KnowledgePage";
import MemoryPage from "./pages/MemoryPage";
import ToolsPage from "./pages/ToolsPage";
import PromptsPage from "./pages/PromptsPage";
import WorkflowsPage from "./pages/WorkflowsPage";
import EvaluationsPage from "./pages/EvaluationsPage";
import DeploymentsPage from "./pages/DeploymentsPage";
import MonitoringPage from "./pages/MonitoringPage";
import DataStoragePage from "./pages/DataStoragePage";
import SecurityPage from "./pages/SecurityPage";
import TeamPage from "./pages/TeamPage";
import BillingPage from "./pages/BillingPage";
import SettingsPage from "./pages/SettingsPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppLayout>
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/agents" element={<AgentsPage />} />
              <Route path="/agents/new" element={<CreateAgentPage />} />
              <Route path="/agents/:id" element={<AgentDetailPage />} />
              <Route path="/knowledge" element={<KnowledgePage />} />
              <Route path="/memory" element={<MemoryPage />} />
              <Route path="/tools" element={<ToolsPage />} />
              <Route path="/prompts" element={<PromptsPage />} />
              <Route path="/workflows" element={<WorkflowsPage />} />
              <Route path="/evaluations" element={<EvaluationsPage />} />
              <Route path="/deployments" element={<DeploymentsPage />} />
              <Route path="/monitoring" element={<MonitoringPage />} />
              <Route path="/data-storage" element={<DataStoragePage />} />
              <Route path="/security" element={<SecurityPage />} />
              <Route path="/team" element={<TeamPage />} />
              <Route path="/billing" element={<BillingPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AppLayout>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
