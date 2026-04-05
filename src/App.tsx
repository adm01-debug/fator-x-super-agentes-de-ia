import { lazy, Suspense } from "react";
import { toast } from "sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageLoading } from "@/components/shared/PageLoading";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { AuthProvider } from "@/contexts/AuthContext";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { ProtectedRoute } from "@/components/rbac/ProtectedRoute";
import type { ReactNode } from "react";

// Lazy-loaded pages
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const AgentsPage = lazy(() => import("./pages/AgentsPage"));
const AgentDetailPage = lazy(() => import("./pages/AgentDetailPage"));
const CreateAgentPage = lazy(() => import("./pages/CreateAgentPage"));
const AgentBuilder = lazy(() => import("./pages/AgentBuilder"));
const AuthPage = lazy(() => import("./pages/AuthPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const SuperCerebroPage = lazy(() => import("./pages/SuperCerebroPage"));
const OraclePage = lazy(() => import("./pages/OraclePage"));
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
const AdminPage = lazy(() => import("./pages/AdminPage"));
const SecurityPage = lazy(() => import("./pages/SecurityPage"));
const TeamPage = lazy(() => import("./pages/TeamPage"));
const BillingPage = lazy(() => import("./pages/BillingPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const LGPDCompliancePage = lazy(() => import("./pages/LGPDCompliancePage"));
const ApprovalQueuePage = lazy(() => import("./pages/ApprovalQueuePage"));
const AIStudioPage = lazy(() => import("./pages/AIStudioPage"));
const FineTuningPage = lazy(() => import("./pages/FineTuningPage"));
const SmolagentPage = lazy(() => import("./pages/SmolagentPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: (failureCount, error) => {
        // Don't retry on 401/403
        if (error instanceof Error && /40[13]/.test(error.message)) return false;
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
    },
    mutations: {
      onError: (error) => {
        const msg = error instanceof Error ? error.message : "Erro desconhecido";
        toast.error("Operação falhou", { description: msg });
      },
    },
  },
});

/** Wraps a lazy page in Suspense + ErrorBoundary */
function SafePage({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageLoading />}>
        {children}
      </Suspense>
    </ErrorBoundary>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/auth" element={<SafePage><AuthPage /></SafePage>} />
              <Route path="/reset-password" element={<SafePage><ResetPasswordPage /></SafePage>} />
              <Route path="*" element={
                <AuthGuard>
                  <AppLayout>
                    <Routes>
                      <Route path="/" element={<SafePage><DashboardPage /></SafePage>} />
                      <Route path="/agents" element={<SafePage><AgentsPage /></SafePage>} />
                      <Route path="/agents/new" element={<SafePage><CreateAgentPage /></SafePage>} />
                      <Route path="/agents/:id" element={<SafePage><AgentDetailPage /></SafePage>} />
                      <Route path="/builder" element={<SafePage><AgentBuilder /></SafePage>} />
                      <Route path="/builder/:id" element={<SafePage><AgentBuilder /></SafePage>} />
                      <Route path="/brain" element={<SafePage><SuperCerebroPage /></SafePage>} />
                      <Route path="/oracle" element={<SafePage><OraclePage /></SafePage>} />
                      <Route path="/knowledge" element={<SafePage><KnowledgePage /></SafePage>} />
                      <Route path="/memory" element={<SafePage><MemoryPage /></SafePage>} />
                      <Route path="/tools" element={<SafePage><ToolsPage /></SafePage>} />
                      <Route path="/prompts" element={<SafePage><PromptsPage /></SafePage>} />
                      <Route path="/prompts/:id" element={<SafePage><PromptEditorPage /></SafePage>} />
                      <Route path="/workflows" element={<SafePage><WorkflowsPage /></SafePage>} />
                      <Route path="/evaluations" element={<SafePage><EvaluationsPage /></SafePage>} />
                      <Route path="/deployments" element={<SafePage><DeploymentsPage /></SafePage>} />
                      <Route path="/monitoring" element={<SafePage><MonitoringPage /></SafePage>} />
                      <Route path="/data-storage" element={<SafePage><DataStoragePage /></SafePage>} />
                      <Route path="/datahub" element={<SafePage><DataHubPage /></SafePage>} />
                      <Route path="/admin" element={<SafePage><ProtectedRoute permission="team.roles"><AdminPage /></ProtectedRoute></SafePage>} />
                      <Route path="/security" element={<SafePage><ProtectedRoute permission="settings.api_keys"><SecurityPage /></ProtectedRoute></SafePage>} />
                      <Route path="/team" element={<SafePage><ProtectedRoute permission="team.read"><TeamPage /></ProtectedRoute></SafePage>} />
                      <Route path="/billing" element={<SafePage><ProtectedRoute permission="settings.billing"><BillingPage /></ProtectedRoute></SafePage>} />
                      <Route path="/settings" element={<SafePage><ProtectedRoute permission="settings.read"><SettingsPage /></ProtectedRoute></SafePage>} />
                      <Route path="/lgpd" element={<SafePage><ProtectedRoute permission="settings.api_keys"><LGPDCompliancePage /></ProtectedRoute></SafePage>} />
                      <Route path="/approvals" element={<SafePage><ProtectedRoute permission="agents.deploy"><ApprovalQueuePage /></ProtectedRoute></SafePage>} />
                      <Route path="/ai-studio" element={<SafePage><AIStudioPage /></SafePage>} />
                      <Route path="/fine-tuning" element={<SafePage><FineTuningPage /></SafePage>} />
                      <Route path="/smolagent" element={<SafePage><SmolagentPage /></SafePage>} />
                      <Route path="*" element={<SafePage><NotFound /></SafePage>} />
                    </Routes>
                  </AppLayout>
                </AuthGuard>
              } />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
