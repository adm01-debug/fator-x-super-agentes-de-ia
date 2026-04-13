import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Trash2 } from 'lucide-react';
import { alertRuleSchema } from '@/lib/validations/agentSchema';
import { listAlertRules, createAlertRule, deleteAlertRule, toggleAlertRule } from '@/services/monitoringService';
import { toast } from 'sonner';

export function AlertRulesPanel() {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [ruleName, setRuleName] = useState('');
  const [ruleMetric, setRuleMetric] = useState('cost_usd');
  const [ruleOp, setRuleOp] = useState('>');
  const [ruleThreshold, setRuleThreshold] = useState('10');
  const [ruleSeverity, setRuleSeverity] = useState('warning');

  const { data: rules = [] } = useQuery({
    queryKey: ['alert_rules'],
    queryFn: listAlertRules,
  });

  const handleCreateRule = async () => {
    const result = alertRuleSchema.safeParse({ name: ruleName, metric: ruleMetric, operator: ruleOp, threshold: parseFloat(ruleThreshold) || 0, severity: ruleSeverity });
    if (!result.success) { toast.error(result.error.errors[0]?.message || 'Dados inválidos'); return; }
    setCreating(true);
    try {
      await createAlertRule({ name: ruleName.trim(), metric: ruleMetric, operator: ruleOp, threshold: parseFloat(ruleThreshold) || 0, severity: ruleSeverity });
      toast.success('Regra criada!');
      setRuleName('');
      queryClient.invalidateQueries({ queryKey: ['alert_rules'] });
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Erro inesperado'); }
    finally { setCreating(false); }
  };

  const handleDeleteRule = async (id: string) => {
    await deleteAlertRule(id);
    queryClient.invalidateQueries({ queryKey: ['alert_rules'] });
    toast.success('Regra removida');
  };

  const handleToggleRule = async (id: string, enabled: boolean) => {
    await toggleAlertRule(id, enabled);
    queryClient.invalidateQueries({ queryKey: ['alert_rules'] });
  };

  return (
    <div className="nexus-card mt-6">
      <h3 className="text-sm font-heading font-semibold text-foreground mb-3">Regras de Alerta Automático</h3>
      <p className="text-xs text-muted-foreground mb-4">Crie regras que disparam alertas quando métricas ultrapassam limites.</p>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mb-4 items-end">
        <div><label className="text-[11px] text-muted-foreground">Nome</label><input value={ruleName} onChange={e => setRuleName(e.target.value)} placeholder="Ex: Custo alto" className="w-full rounded-lg border border-border bg-secondary/50 px-2 py-1.5 text-xs" /></div>
        <div><label className="text-[11px] text-muted-foreground">Métrica</label>
          <select value={ruleMetric} onChange={e => setRuleMetric(e.target.value)} className="w-full rounded-lg border border-border bg-secondary/50 px-2 py-1.5 text-xs">
            <option value="cost_usd">Custo (USD)</option><option value="latency_ms">Latência (ms)</option><option value="tokens_used">Tokens</option><option value="error_count">Erros</option>
          </select></div>
        <div><label className="text-[11px] text-muted-foreground">Operador</label>
          <select value={ruleOp} onChange={e => setRuleOp(e.target.value)} className="w-full rounded-lg border border-border bg-secondary/50 px-2 py-1.5 text-xs">
            <option value=">">&gt;</option><option value=">=">&gt;=</option><option value="<">&lt;</option><option value="<=">&lt;=</option><option value="==">=</option>
          </select></div>
        <div><label className="text-[11px] text-muted-foreground">Threshold</label><input type="number" value={ruleThreshold} onChange={e => setRuleThreshold(e.target.value)} className="w-full rounded-lg border border-border bg-secondary/50 px-2 py-1.5 text-xs" /></div>
        <div><label className="text-[11px] text-muted-foreground">Severidade</label>
          <select value={ruleSeverity} onChange={e => setRuleSeverity(e.target.value)} className="w-full rounded-lg border border-border bg-secondary/50 px-2 py-1.5 text-xs">
            <option value="info">Info</option><option value="warning">Warning</option><option value="critical">Critical</option>
          </select></div>
        <Button size="sm" onClick={handleCreateRule} disabled={creating} className="nexus-gradient-bg text-primary-foreground text-xs">
          {creating ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Criar regra'}
        </Button>
      </div>

      {rules.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">Nenhuma regra criada. Alertas de budget são automáticos via trigger.</p>
      ) : (
        <div className="space-y-2">
          {rules.map((rule: Record<string, unknown>) => (
            <div key={String(rule.id)} className="flex items-center justify-between py-2 px-3 rounded-lg bg-secondary/30 text-xs">
              <div className="flex items-center gap-3">
                <input type="checkbox" checked={Boolean(rule.is_enabled)} onChange={e => handleToggleRule(String(rule.id), e.target.checked)} className="rounded" />
                <div>
                  <span className="font-medium text-foreground">{String(rule.name)}</span>
                  <span className="text-muted-foreground ml-2">{String(rule.metric)} {String(rule.operator)} {String(rule.threshold)}</span>
                </div>
                <Badge variant={rule.severity === 'critical' ? 'destructive' : 'outline'} className="text-[11px]">{String(rule.severity)}</Badge>
              </div>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleDeleteRule(String(rule.id))}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
