import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
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
  { id: 'schedules', label: 'Agendamentos', icon: Clock, color: '#4D96FF' },
  { id: 'webhooks', label: 'Webhooks', icon: Webhook, color: '#9B59B6' },
  { id: 'notifications', label: 'Notificações', icon: Bell, color: '#6BCB77' },
  { id: 'templates', label: 'Templates', icon: LayoutTemplate, color: '#E67E22' },
  { id: 'history', label: 'Histórico', icon: History, color: '#FFD93D' },
  { id: 'connectors', label: 'Conectores', icon: Plug, color: '#4D96FF' },
  { id: 'queues', label: 'Filas', icon: ListOrdered, color: '#FF6B6B' },
  { id: 'credentials', label: 'Credenciais', icon: Lock, color: '#9B59B6' },
  { id: 'batch', label: 'Batch', icon: Layers, color: '#6BCB77' },
] as const;

export default function AutomationCenterPage() {
  const [activeTab, setActiveTab] = useState('schedules');

  return (
    <div className="min-h-screen bg-[#050510] text-white p-6">
      <div className="max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#4D96FF] to-[#9B59B6] flex items-center justify-center text-xl">
              ⚡
            </div>
            <div>
              <h1 className="text-2xl font-bold">Automation Center</h1>
              <p className="text-sm text-gray-400">
                Gerencie agendamentos, webhooks, notificações, filas e integrações
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-[#111122] border border-[#222244] p-1 flex flex-wrap gap-1 h-auto mb-6">
            {TABS.map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="flex items-center gap-2 px-3 py-2 data-[state=active]:bg-[#1a1a3e] data-[state=active]:text-white text-gray-400"
              >
                <tab.icon size={16} style={{ color: tab.color }} />
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
    </div>
  );
}
