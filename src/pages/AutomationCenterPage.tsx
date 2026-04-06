import { useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { Clock, Webhook, Bell, LayoutTemplate, History, Plug, ListOrdered, Lock, Layers } from 'lucide-react';
import { CronSchedulerPanel } from '@/components/automation/CronSchedulerPanel';
import { WebhookManagerPanel } from '@/components/automation/WebhookManagerPanel';
import { NotificationCenterPanel } from '@/components/automation/NotificationCenterPanel';
import { AutomationTemplatesPanel } from '@/components/automation/AutomationTemplatesPanel';
import { ExecutionHistoryPanel } from '@/components/automation/ExecutionHistoryPanel';
import { ConnectorRegistryPanel } from '@/components/automation/ConnectorRegistryPanel';
import { QueueMonitorPanel } from '@/components/automation/QueueMonitorPanel';
import { CredentialVaultPanel } from '@/components/automation/CredentialVaultPanel';
import { BatchProcessorPanel } from '@/components/automation/BatchProcessorPanel';

const TABS = [
  { id: 'schedules', label: 'Agendamentos', icon: Clock },
  { id: 'webhooks', label: 'Webhooks', icon: Webhook },
  { id: 'notifications', label: 'Notificações', icon: Bell },
  { id: 'templates', label: 'Templates', icon: LayoutTemplate },
  { id: 'history', label: 'Histórico', icon: History },
  { id: 'connectors', label: 'Conectores', icon: Plug },
  { id: 'queues', label: 'Filas', icon: ListOrdered },
  { id: 'credentials', label: 'Credenciais', icon: Lock },
  { id: 'batch', label: 'Batch', icon: Layers },
] as const;

export default function AutomationCenterPage() {
  const [activeTab, setActiveTab] = useState('schedules');

  return (
    <div className="p-6 sm:p-8 lg:p-10 space-y-6 max-w-[1400px] mx-auto">
      <PageHeader
        title="⚡ Centro de Automação"
        description="Gerencie agendamentos, webhooks, notificações, filas e integrações"
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-secondary/50 border border-border/50 p-1 flex flex-wrap gap-1 h-auto mb-6">
          {TABS.map((tab) => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className="flex items-center gap-2 px-3 py-2 text-muted-foreground data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm"
            >
              <tab.icon className="h-4 w-4" />
              <span className="text-xs sm:text-sm">{tab.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="schedules"><CronSchedulerPanel /></TabsContent>
        <TabsContent value="webhooks"><WebhookManagerPanel /></TabsContent>
        <TabsContent value="notifications"><NotificationCenterPanel /></TabsContent>
        <TabsContent value="templates"><AutomationTemplatesPanel /></TabsContent>
        <TabsContent value="history"><ExecutionHistoryPanel /></TabsContent>
        <TabsContent value="connectors"><ConnectorRegistryPanel /></TabsContent>
        <TabsContent value="queues"><QueueMonitorPanel /></TabsContent>
        <TabsContent value="credentials"><CredentialVaultPanel /></TabsContent>
        <TabsContent value="batch"><BatchProcessorPanel /></TabsContent>
      </Tabs>
    </div>
  );
}
