import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Bell, Plus, Sparkles } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { getAgentById } from '@/services/agentsService';
import { listAgentTraces } from '@/services/agentTracesService';
import {
  alertRulesService, evaluateRule, makeRuleFromTemplate, ALERT_RULE_TEMPLATES,
  type AlertRule,
} from '@/services/alertRulesService';
import { AlertRulesList } from '@/components/agents/alerts/AlertRulesList';
import { AlertRuleEditor } from '@/components/agents/alerts/AlertRuleEditor';
import { AlertSimulationPanel } from '@/components/agents/alerts/AlertSimulationPanel';

export default function AgentAlertsPage() {
  const { id } = useParams();
  const agentId = id!;
  const workspaceId = null; // local-scoped; could be plugged when workspaces propagate here

  const { data: agent } = useQuery({
    queryKey: ['agent', id],
    queryFn: () => getAgentById(agentId),
    enabled: !!agentId,
  });

  const { data: traces = [] } = useQuery({
    queryKey: ['agent-traces-for-alerts', agentId],
    queryFn: () => listAgentTraces({ agentId, sinceHours: 24, limit: 500 }),
    staleTime: 30_000,
  });

  const [rules, setRules] = useState<AlertRule[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorInitial, setEditorInitial] = useState<AlertRule | null>(null);

  // Load rules from local persistence
  useEffect(() => {
    setRules(alertRulesService.list(workspaceId, agentId));
  }, [agentId, workspaceId]);

  // Pick a default selection when rules change
  useEffect(() => {
    if (!selectedId && rules.length > 0) setSelectedId(rules[0].id);
    if (selectedId && !rules.find((r) => r.id === selectedId)) {
      setSelectedId(rules[0]?.id ?? null);
    }
  }, [rules, selectedId]);

  const selected = useMemo(() => rules.find((r) => r.id === selectedId) ?? null, [rules, selectedId]);

  const triggeredIds = useMemo(() => {
    const set = new Set<string>();
    for (const r of rules) {
      if (!r.is_enabled) continue;
      if (evaluateRule(r, traces).triggers) set.add(r.id);
    }
    return set;
  }, [rules, traces]);

  const summary = useMemo(() => {
    const active = rules.filter((r) => r.is_enabled).length;
    let warnings = 0;
    let criticals = 0;
    for (const r of rules) {
      if (!r.is_enabled) continue;
      if (!triggeredIds.has(r.id)) continue;
      if (r.severity === 'critical') criticals++;
      else if (r.severity === 'warning') warnings++;
    }
    return { total: rules.length, active, warnings, criticals };
  }, [rules, triggeredIds]);

  const handleSave = (rule: AlertRule) => {
    const saved = alertRulesService.upsert(workspaceId, agentId, rule);
    setRules(alertRulesService.list(workspaceId, agentId));
    setSelectedId(saved.id);
    toast.success(editorInitial ? 'Regra atualizada' : 'Regra criada');
  };

  const handleDelete = (rule: AlertRule) => {
    alertRulesService.remove(workspaceId, agentId, rule.id);
    setRules(alertRulesService.list(workspaceId, agentId));
    toast.success('Regra removida');
  };

  const handleToggle = (rule: AlertRule, enabled: boolean) => {
    alertRulesService.toggle(workspaceId, agentId, rule.id, enabled);
    setRules(alertRulesService.list(workspaceId, agentId));
  };

  const handleApplyTemplate = (idx: number) => {
    const tpl = ALERT_RULE_TEMPLATES[idx];
    const rule = makeRuleFromTemplate(tpl, agentId, workspaceId);
    alertRulesService.upsert(workspaceId, agentId, rule);
    setRules(alertRulesService.list(workspaceId, agentId));
    setSelectedId(rule.id);
    toast.success(`Template aplicado: ${tpl.name}`);
  };

  const openCreate = () => {
    setEditorInitial(null);
    setEditorOpen(true);
  };

  const openEdit = (rule: AlertRule) => {
    setEditorInitial(rule);
    setEditorOpen(true);
  };

  return (
    <div className="p-6 sm:p-8 lg:p-10 space-y-5 max-w-[1500px] mx-auto animate-page-enter">
      <PageHeader
        title={agent ? `Alertas — ${agent.name}` : 'Alertas do agente'}
        description="Regras configuráveis para latência, custo, falhas de tools e memória, com prévia em tempo real e simulação retroativa."
        backTo={`/agents/${agentId}`}
        actions={
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Templates
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuLabel>Aplicar template pronto</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {ALERT_RULE_TEMPLATES.map((t, i) => (
                  <DropdownMenuItem key={t.name} onClick={() => handleApplyTemplate(i)} className="flex-col items-start gap-0.5">
                    <span className="text-xs font-medium">{t.name}</span>
                    <span className="text-[10px] text-muted-foreground">{t.description}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Nova regra
            </Button>
          </div>
        }
      />

      {/* Summary */}
      <Card>
        <CardContent className="p-4 flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" aria-hidden />
            <span className="text-sm font-medium text-foreground">{summary.total} regras</span>
          </div>
          <span className="text-xs text-muted-foreground">{summary.active} ativas</span>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Disparariam agora:</span>
            <Badge className="bg-nexus-amber/15 text-nexus-amber border-nexus-amber/30 border">⚠ {summary.warnings} warning</Badge>
            <Badge className="bg-destructive/15 text-destructive border-destructive/30 border">✗ {summary.criticals} critical</Badge>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Regras configuradas</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[640px]">
              <AlertRulesList
                rules={rules}
                selectedId={selectedId}
                triggeredIds={triggeredIds}
                onSelect={(r) => setSelectedId(r.id)}
                onToggle={handleToggle}
                onEdit={openEdit}
                onDelete={handleDelete}
                onCreateNew={openCreate}
              />
            </ScrollArea>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Prévia & simulação</CardTitle>
          </CardHeader>
          <CardContent>
            <AlertSimulationPanel rule={selected} traces={traces} onEdit={openEdit} />
          </CardContent>
        </Card>
      </div>

      <AlertRuleEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        initial={editorInitial}
        agentId={agentId}
        workspaceId={workspaceId}
        traces={traces}
        onSave={handleSave}
      />
    </div>
  );
}
