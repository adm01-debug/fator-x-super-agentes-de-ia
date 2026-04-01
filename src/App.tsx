import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageLoading } from "@/components/shared/PageLoading";
import { AuthProvider } from "@/contexts/AuthContext";

// Lazy-loaded pages for code splitting
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const AgentsPage = lazy(() => import("./pages/AgentsPage"));
const AgentDetailPage = lazy(() => import("./pages/AgentDetailPage"));
const CreateAgentPage = lazy(() => import("./pages/CreateAgentPage"));
const AgentBuilder = lazy(() => import("./pages/AgentBuilder"));
const AuthPage = lazy(() => import("./pages/AuthPage"));
const KnowledgePage = lazy(() => import("./pages/KnowledgePage"));
const MemoryPage = lazy(() => import("./pages/MemoryPage"));
const ToolsPage = lazy(() => import("./pages/ToolsPage"));
const PromptsPage = lazy(() => import("./pages/PromptsPage"));
const PromptEditorPage = lazy(() => import("./pages/PromptEditorPage"));
const WorkflowsPage = lazy(() => import("./pages/WorkflowsPage"));
const EvaluationsPage = lazy(() => import("./pages/EvaluationsPage"));
const DeploymentsPage = lazy(() => import("./pages/DeploymentsPage"));
const MonitoringPage = lazy(() => import("./pages/MonitoringPage"));
const DataStoragePage = lazy(() => import("./pages/DataStoragePage"));
const DataHubPage = lazy(() => import("./pages/DataHubPage"));
const SuperCerebroPage = lazy(() => import("./pages/SuperCerebroPage"));
const OraculoPage = lazy(() => import("./pages/OraculoPage"));
const DatabaseManagerPage = lazy(() => import("./pages/DatabaseManagerPage"));
const MarketplacePage = lazy(() => import("./pages/MarketplacePage"));
const SecurityPage = lazy(() => import("./pages/SecurityPage"));
const TeamPage = lazy(() => import("./pages/TeamPage"));
const BillingPage = lazy(() => import("./pages/BillingPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/auth" element={
                <Suspense fallback={<PageLoading />}><AuthPage /></Suspense>
              } />
              <Route path="*" element={
                <AppLayout>
                  <Suspense fallback={<PageLoading />}>
                    <Routes>
                      <Route path="/" element={<DashboardPage />} />
                      <Route path="/agents" element={<AgentsPage />} />
                      <Route path="/agents/new" element={<CreateAgentPage />} />
                      <Route path="/agents/:id" element={<AgentDetailPage />} />
                      <Route path="/builder" element={<AgentBuilder />} />
                      <Route path="/builder/:id" element={<AgentBuilder />} />
                      <Route path="/knowledge" element={<KnowledgePage />} />
                      <Route path="/memory" element={<MemoryPage />} />
                      <Route path="/tools" element={<ToolsPage />} />
                      <Route path="/prompts" element={<PromptsPage />} />
                      <Route path="/prompts/:id" element={<PromptEditorPage />} />
                      <Route path="/workflows" element={<WorkflowsPage />} />
                      <Route path="/evaluations" element={<EvaluationsPage />} />
                      <Route path="/deployments" element={<DeploymentsPage />} />
                      <Route path="/monitoring" element={<MonitoringPage />} />
                      <Route path="/data-storage" element={<DataStoragePage />} />
                      <Route path="/datahub" element={<DataHubPage />} />
                      <Route path="/brain" element={<SuperCerebroPage />} />
                      <Route path="/oracle" element={<OraculoPage />} />
                      <Route path="/db-manager" element={<DatabaseManagerPage />} />
                      <Route path="/marketplace" element={<MarketplacePage />} />
                      <Route path="/security" element={<SecurityPage />} />
                      <Route path="/team" element={<TeamPage />} />
                      <Route path="/billing" element={<BillingPage />} />
                      <Route path="/settings" element={<SettingsPage />} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </Suspense>
                </AppLayout>
              } />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
