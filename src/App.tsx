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
import { HealthAlertsMounter } from "@/components/shared/HealthAlertsMounter";
import { SLOAlertsMounter } from "@/components/shared/SLOAlertsMounter";
import { SyntheticAlertsMounter } from "@/components/shared/SyntheticAlertsMounter";
import { CostAnomalyAlertsMounter } from "@/components/shared/CostAnomalyAlertsMounter";
import { BudgetEventsMounter } from "@/components/shared/BudgetEventsMounter";
import { IncidentRunsMounter } from "@/components/shared/IncidentRunsMounter";
import { ChaosBanner } from "@/components/shared/ChaosBanner";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { AuthProvider } from "@/contexts/AuthContext";
import { I18nProvider } from "@/i18n/I18nProvider";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { ProtectedRoute } from "@/components/rbac/ProtectedRoute";
import type { ReactNode } from "react";

// Lazy-loaded pages
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const AgentsPage = lazy(() => import("./pages/AgentsPage"));
const AgentDetailPage = lazy(() => import("./pages/AgentDetailPage"));
const CreateAgentPage = lazy(() => import("./pages/CreateAgentPage"));
const AgentTemplatesPage = lazy(() => import("./pages/AgentTemplatesPage"));
const AgentBuilder = lazy(() => import("./pages/AgentBuilder"));
const AuthPage = lazy(() => import("./pages/AuthPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const SuperCerebroPage = lazy(() => import("./pages/SuperCerebroPage"));
const OraclePage = lazy(() => import("./pages/OraclePage"));
const KnowledgePage = lazy(() => import("./pages/KnowledgePage"));
const MemoryPage = lazy(() => import("./pages/MemoryPage"));
const ToolsPage = lazy(() => import("./pages/ToolsPage"));
const RoutingConfigPage = lazy(() => import("./pages/RoutingConfigPage"));
const PromptsPage = lazy(() => import("./pages/PromptsPage"));
const PromptEditorPage = lazy(() => import("./pages/PromptEditorPage"));
const WorkflowsPage = lazy(() => import("./pages/WorkflowsPage"));
const EvaluationsPage = lazy(() => import("./pages/EvaluationsPage"));
const DeploymentsPage = lazy(() => import("./pages/DeploymentsPage"));
const OpenclawDeployPage = lazy(() => import("./pages/OpenclawDeployPage"));
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
const SkillsMarketplacePage = lazy(() => import("./pages/SkillsMarketplacePage"));
const AutomationCenterPage = lazy(() => import("./pages/AutomationCenterPage"));
const AutomationsPage = lazy(() => import("./pages/AutomationsPage"));
const RolesPage = lazy(() => import("./pages/RolesPage"));
const PermissionsPage = lazy(() => import("./pages/PermissionsPage"));
const RolePermissionsPage = lazy(() => import("./pages/RolePermissionsPage"));
const SearchPage = lazy(() => import("./pages/SearchPage"));
const NLPPipelinePage = lazy(() => import("./pages/NLPPipelinePage"));
const TracesTimelinePage = lazy(() => import("./pages/TracesTimelinePage"));
const VoiceAgentStudioPage = lazy(() => import("./pages/VoiceAgentStudioPage"));
const VoiceAgentsPage = lazy(() => import("./pages/VoiceAgentsPage"));
const BrowserAgentPage = lazy(() => import("./pages/BrowserAgentPage"));
const AgentOrchestrationPage = lazy(() => import("./pages/AgentOrchestrationPage"));
const ReplayForkPage = lazy(() => import("./pages/ReplayForkPage"));
const EnterpriseSSOPage = lazy(() => import("./pages/EnterpriseSSOPage"));
const DataResidencyPage = lazy(() => import("./pages/DataResidencyPage"));
const ComputerUsePage = lazy(() => import("./pages/ComputerUsePage"));
const VisionAgentsPage = lazy(() => import("./pages/VisionAgentsPage"));
const MobileSDKPage = lazy(() => import("./pages/MobileSDKPage"));
const PromptABTestPage = lazy(() => import("./pages/PromptABTestPage"));
const PromptExperimentsPage = lazy(() => import("./pages/PromptExperimentsPage"));
const MarketplaceMonetizedPage = lazy(() => import("./pages/MarketplaceMonetizedPage"));
const SyntheticDataPage = lazy(() => import("./pages/SyntheticDataPage"));
const CanaryDeploymentsPage = lazy(() => import("./pages/CanaryDeploymentsPage"));
const CodeInterpreterPage = lazy(() => import("./pages/CodeInterpreterPage"));
const EmailCalendarTriggersPage = lazy(() => import("./pages/EmailCalendarTriggersPage"));
const AgentDebuggerPage = lazy(() => import("./pages/AgentDebuggerPage"));
const ComplianceReportsPage = lazy(() => import("./pages/ComplianceReportsPage"));
const VoiceTelephonyPage = lazy(() => import("./pages/VoiceTelephonyPage"));
const KnowledgeGraphPage = lazy(() => import("./pages/KnowledgeGraphPage"));
const AgentSimulationPage = lazy(() => import("./pages/AgentSimulationPage"));
const CostOptimizerPage = lazy(() => import("./pages/CostOptimizerPage"));
const FederatedLearningPage = lazy(() => import("./pages/FederatedLearningPage"));
const MultiTenancyPage = lazy(() => import("./pages/MultiTenancyPage"));
const ObservabilityOTelPage = lazy(() => import("./pages/ObservabilityOTelPage"));
const DisasterRecoveryPage = lazy(() => import("./pages/DisasterRecoveryPage"));
const GameDaysPage = lazy(() => import("./pages/GameDaysPage"));
const GameDayLivePage = lazy(() => import("./pages/GameDayLivePage"));
const IncidentPlaybooksPage = lazy(() => import("./pages/IncidentPlaybooksPage"));
const OncallPage = lazy(() => import("./pages/OncallPage"));
const DRDrillsPage = lazy(() => import("./pages/DRDrillsPage"));
const PostmortemsPage = lazy(() => import("./pages/PostmortemsPage"));
const PostmortemEditorPage = lazy(() => import("./pages/PostmortemEditorPage"));
const SLODashboard = lazy(() => import("./pages/SLODashboard"));
const ChaosLabPage = lazy(() => import("./pages/ChaosLabPage"));
const SyntheticMonitoringPage = lazy(() => import("./pages/SyntheticMonitoringPage"));
const CostAnomaliesPage = lazy(() => import("./pages/CostAnomaliesPage"));
const BudgetSettingsPage = lazy(() => import("./pages/BudgetSettingsPage"));
const KnowledgeManagementPage = lazy(() => import("./pages/KnowledgeManagementPage"));
const ArticleEditorPage = lazy(() => import("./pages/ArticleEditorPage"));
const PublicHelpCenterPage = lazy(() => import("./pages/PublicHelpCenterPage"));
const PublicForumPage = lazy(() => import("./pages/PublicForumPage"));
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
      <I18nProvider>
        <AuthProvider>
          <HealthAlertsMounter />
          <SLOAlertsMounter />
              <SyntheticAlertsMounter />
              <CostAnomalyAlertsMounter />
              <BudgetEventsMounter />
              <IncidentRunsMounter />
          <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/auth" element={<SafePage><AuthPage /></SafePage>} />
              <Route path="/reset-password" element={<SafePage><ResetPasswordPage /></SafePage>} />
              <Route path="/help/:slug" element={<SafePage><PublicHelpCenterPage /></SafePage>} />
              <Route path="/help/:slug/forum" element={<SafePage><PublicForumPage /></SafePage>} />
              <Route path="/help/:slug/forum/:threadId" element={<SafePage><PublicForumPage /></SafePage>} />
              <Route path="/help/:slug/:articleSlug" element={<SafePage><PublicHelpCenterPage /></SafePage>} />
              <Route path="*" element={
                <AuthGuard>
                  <ChaosBanner />
                  <AppLayout>
                    <Routes>
                      <Route path="/" element={<SafePage><DashboardPage /></SafePage>} />
                      <Route path="/dashboard" element={<SafePage><DashboardPage /></SafePage>} />
                      <Route path="/agents" element={<SafePage><AgentsPage /></SafePage>} />
                      <Route path="/agents/new" element={<SafePage><CreateAgentPage /></SafePage>} />
                      <Route path="/agents/templates" element={<SafePage><AgentTemplatesPage /></SafePage>} />
                      <Route path="/agents/:id" element={<SafePage><AgentDetailPage /></SafePage>} />
                      <Route path="/builder" element={<SafePage><AgentBuilder /></SafePage>} />
                      <Route path="/builder/:id" element={<SafePage><AgentBuilder /></SafePage>} />
                      <Route path="/brain" element={<SafePage><SuperCerebroPage /></SafePage>} />
                      <Route path="/super-cerebro" element={<SafePage><SuperCerebroPage /></SafePage>} />
                      <Route path="/oracle" element={<SafePage><OraclePage /></SafePage>} />
                      <Route path="/knowledge" element={<SafePage><KnowledgePage /></SafePage>} />
                      <Route path="/knowledge-management" element={<SafePage><KnowledgeManagementPage /></SafePage>} />
                      <Route path="/knowledge-management/article/:id" element={<SafePage><ArticleEditorPage /></SafePage>} />
                      <Route path="/memory" element={<SafePage><MemoryPage /></SafePage>} />
                      <Route path="/tools" element={<SafePage><ToolsPage /></SafePage>} />
                      <Route path="/routing" element={<SafePage><RoutingConfigPage /></SafePage>} />
                      <Route path="/prompts" element={<SafePage><PromptsPage /></SafePage>} />
                      <Route path="/prompts/experiments" element={<SafePage><PromptExperimentsPage /></SafePage>} />
                      <Route path="/prompts/:id" element={<SafePage><PromptEditorPage /></SafePage>} />
                      <Route path="/workflows" element={<SafePage><WorkflowsPage /></SafePage>} />
                      <Route path="/automation" element={<SafePage><AutomationCenterPage /></SafePage>} />
                      <Route path="/automations" element={<SafePage><AutomationsPage /></SafePage>} />
                      <Route path="/evaluations" element={<SafePage><EvaluationsPage /></SafePage>} />
                      <Route path="/deployments" element={<SafePage><DeploymentsPage /></SafePage>} />
                      <Route path="/deploy/openclaw" element={<SafePage><OpenclawDeployPage /></SafePage>} />
                      <Route path="/monitoring" element={<SafePage><MonitoringPage /></SafePage>} />
                      <Route path="/data-storage" element={<SafePage><DataStoragePage /></SafePage>} />
                      <Route path="/datahub" element={<SafePage><DataHubPage /></SafePage>} />
                      <Route path="/admin" element={<SafePage><ProtectedRoute permission="team.roles"><AdminPage /></ProtectedRoute></SafePage>} />
                      <Route path="/security" element={<SafePage><ProtectedRoute permission="settings.api_keys"><SecurityPage /></ProtectedRoute></SafePage>} />
                      <Route path="/team" element={<SafePage><ProtectedRoute permission="team.read"><TeamPage /></ProtectedRoute></SafePage>} />
                      <Route path="/billing" element={<SafePage><ProtectedRoute permission="settings.billing"><BillingPage /></ProtectedRoute></SafePage>} />
                      <Route path="/settings" element={<SafePage><ProtectedRoute permission="settings.read"><SettingsPage /></ProtectedRoute></SafePage>} />
                      <Route path="/settings/budget" element={<SafePage><ProtectedRoute permission="settings.billing"><BudgetSettingsPage /></ProtectedRoute></SafePage>} />
                      <Route path="/lgpd" element={<SafePage><ProtectedRoute permission="settings.api_keys"><LGPDCompliancePage /></ProtectedRoute></SafePage>} />
                      <Route path="/approvals" element={<SafePage><ProtectedRoute permission="agents.deploy"><ApprovalQueuePage /></ProtectedRoute></SafePage>} />
                      <Route path="/ai-studio" element={<SafePage><AIStudioPage /></SafePage>} />
                      <Route path="/fine-tuning" element={<SafePage><FineTuningPage /></SafePage>} />
                      <Route path="/smolagent" element={<SafePage><SmolagentPage /></SafePage>} />
                      <Route path="/skills" element={<SafePage><SkillsMarketplacePage /></SafePage>} />
                      <Route path="/rbac/roles" element={<SafePage><ProtectedRoute permission="team.roles"><RolesPage /></ProtectedRoute></SafePage>} />
                      <Route path="/rbac/roles/:roleKey" element={<SafePage><ProtectedRoute permission="team.roles"><RolePermissionsPage /></ProtectedRoute></SafePage>} />
                      <Route path="/rbac/permissions" element={<SafePage><ProtectedRoute permission="team.roles"><PermissionsPage /></ProtectedRoute></SafePage>} />
                      <Route path="/search" element={<SafePage><SearchPage /></SafePage>} />
                      <Route path="/nlp" element={<SafePage><NLPPipelinePage /></SafePage>} />
                      <Route path="/traces" element={<SafePage><TracesTimelinePage /></SafePage>} />
                      <Route path="/voice" element={<SafePage><VoiceAgentStudioPage /></SafePage>} />
                      <Route path="/voice-agents" element={<SafePage><VoiceAgentsPage /></SafePage>} />
                      <Route path="/browser-agent" element={<SafePage><BrowserAgentPage /></SafePage>} />
                      <Route path="/orchestration" element={<SafePage><AgentOrchestrationPage /></SafePage>} />
                      <Route path="/replay" element={<SafePage><ReplayForkPage /></SafePage>} />
                      <Route path="/sso" element={<SafePage><ProtectedRoute permission="settings.api_keys"><EnterpriseSSOPage /></ProtectedRoute></SafePage>} />
                      <Route path="/residency" element={<SafePage><ProtectedRoute permission="settings.api_keys"><DataResidencyPage /></ProtectedRoute></SafePage>} />
                      <Route path="/computer-use" element={<SafePage><ComputerUsePage /></SafePage>} />
                      <Route path="/vision" element={<SafePage><VisionAgentsPage /></SafePage>} />
                      <Route path="/mobile-sdk" element={<SafePage><MobileSDKPage /></SafePage>} />
                      <Route path="/ab-test" element={<SafePage><PromptABTestPage /></SafePage>} />
                      <Route path="/marketplace-pro" element={<SafePage><MarketplaceMonetizedPage /></SafePage>} />
                      <Route path="/synthetic-data" element={<SafePage><SyntheticDataPage /></SafePage>} />
                      <Route path="/canary" element={<SafePage><CanaryDeploymentsPage /></SafePage>} />
                      <Route path="/code-interpreter" element={<SafePage><CodeInterpreterPage /></SafePage>} />
                      <Route path="/email-triggers" element={<SafePage><EmailCalendarTriggersPage /></SafePage>} />
                      <Route path="/debugger" element={<SafePage><AgentDebuggerPage /></SafePage>} />
                      <Route path="/compliance-reports" element={<SafePage><ProtectedRoute permission="settings.api_keys"><ComplianceReportsPage /></ProtectedRoute></SafePage>} />
                      <Route path="/voice-telephony" element={<SafePage><VoiceTelephonyPage /></SafePage>} />
                      <Route path="/knowledge-graph" element={<SafePage><KnowledgeGraphPage /></SafePage>} />
                      <Route path="/simulation" element={<SafePage><AgentSimulationPage /></SafePage>} />
                      <Route path="/cost-optimizer" element={<SafePage><CostOptimizerPage /></SafePage>} />
                      <Route path="/federated-learning" element={<SafePage><ProtectedRoute permission="settings.api_keys"><FederatedLearningPage /></ProtectedRoute></SafePage>} />
                      <Route path="/multi-tenancy" element={<SafePage><ProtectedRoute permission="team.roles"><MultiTenancyPage /></ProtectedRoute></SafePage>} />
                      <Route path="/observability" element={<SafePage><ObservabilityOTelPage /></SafePage>} />
                      <Route path="/observability/slo" element={<SafePage><SLODashboard /></SafePage>} />
                      <Route path="/observability/chaos" element={<SafePage><ProtectedRoute permission="settings.api_keys"><ChaosLabPage /></ProtectedRoute></SafePage>} />
                      <Route path="/observability/synthetic" element={<SafePage><SyntheticMonitoringPage /></SafePage>} />
                      <Route path="/observability/cost-anomalies" element={<SafePage><CostAnomaliesPage /></SafePage>} />
                      <Route path="/observability/game-days" element={<SafePage><GameDaysPage /></SafePage>} />
                      <Route path="/observability/game-days/:id/live" element={<SafePage><GameDayLivePage /></SafePage>} />
                      <Route path="/observability/playbooks" element={<SafePage><IncidentPlaybooksPage /></SafePage>} />
                      <Route path="/observability/oncall" element={<SafePage><OncallPage /></SafePage>} />
                      <Route path="/observability/dr-drills" element={<SafePage><ProtectedRoute permission="settings.api_keys"><DRDrillsPage /></ProtectedRoute></SafePage>} />
                      <Route path="/observability/postmortems" element={<SafePage><PostmortemsPage /></SafePage>} />
                      <Route path="/observability/postmortems/:id" element={<SafePage><PostmortemEditorPage /></SafePage>} />
                      <Route path="/disaster-recovery" element={<SafePage><ProtectedRoute permission="settings.api_keys"><DisasterRecoveryPage /></ProtectedRoute></SafePage>} />
                      <Route path="*" element={<SafePage><NotFound /></SafePage>} />
                    </Routes>
                  </AppLayout>
                </AuthGuard>
              } />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
        </AuthProvider>
      </I18nProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
