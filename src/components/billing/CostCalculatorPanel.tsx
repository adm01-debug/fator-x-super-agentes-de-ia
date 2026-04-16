/**
 * CostCalculatorPanel — Interactive LLM cost calculator.
 * Wires costCalculatorService into BillingPage.
 */
import { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calculator, ArrowUpDown, DollarSign } from 'lucide-react';
import { getAllPricing, calculateCost, formatCostUsd, formatCostBrl, compareCosts, type ModelPricing, type ActualCost } from '@/services/costCalculatorService';
import { Button } from '@/components/ui/button';

export function CostCalculatorPanel() {
  const allPricing = useMemo(() => getAllPricing(), []);
  const providers = useMemo(() => [...new Set(allPricing.map(p => p.provider))], [allPricing]);

  const [provider, setProvider] = useState(providers[0] || 'openai');
  const [model, setModel] = useState('');
  const [inputTokens, setInputTokens] = useState('1000');
  const [outputTokens, setOutputTokens] = useState('500');
  const [result, setResult] = useState<ActualCost | null>(null);
  const [showComparison, setShowComparison] = useState(false);

  const modelsForProvider = useMemo(
    () => allPricing.filter(p => p.provider === provider),
    [allPricing, provider]
  );

  const handleCalculate = () => {
    const inp = parseInt(inputTokens) || 0;
    const out = parseInt(outputTokens) || 0;
    const m = model || modelsForProvider[0]?.model || '';
    if (!m) return;
    try {
      const cost = calculateCost(provider, m, inp, out);
      setResult(cost);
    } catch { /* ignore */ }
  };

  const comparison = useMemo(() => {
    if (!showComparison) return [];
    const inp = parseInt(inputTokens) || 1000;
    const out = parseInt(outputTokens) || 500;
    return compareCosts(inp, out);
  }, [showComparison, inputTokens, outputTokens]);

  return (
    <div className="nexus-card space-y-4">
      <div className="flex items-center gap-2.5">
        <div className="h-9 w-9 rounded-xl bg-nexus-amber/10 flex items-center justify-center">
          <Calculator className="h-4 w-4 text-nexus-amber" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">Calculadora de Custos LLM</h3>
          <p className="text-[11px] text-muted-foreground">{allPricing.length} modelos · {providers.length} providers · Preços abril 2026</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        <div className="space-y-1">
          <label className="text-[10px] font-medium text-muted-foreground uppercase">Provider</label>
          <Select value={provider} onValueChange={v => { setProvider(v); setModel(''); }}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {providers.map(p => <SelectItem key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-medium text-muted-foreground uppercase">Modelo</label>
          <Select value={model || modelsForProvider[0]?.model || ''} onValueChange={setModel}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {modelsForProvider.map(m => <SelectItem key={m.model} value={m.model}>{m.model}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-medium text-muted-foreground uppercase">Tokens Input</label>
          <Input className="h-8 text-xs" type="number" value={inputTokens} onChange={e => setInputTokens(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-medium text-muted-foreground uppercase">Tokens Output</label>
          <Input className="h-8 text-xs" type="number" value={outputTokens} onChange={e => setOutputTokens(e.target.value)} />
        </div>
      </div>

      <div className="flex gap-2">
        <Button size="sm" className="gap-1.5 text-xs" onClick={handleCalculate}>
          <DollarSign className="h-3.5 w-3.5" /> Calcular
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setShowComparison(!showComparison)}>
          <ArrowUpDown className="h-3.5 w-3.5" /> {showComparison ? 'Ocultar' : 'Comparar'} Todos
        </Button>
      </div>

      {result && (
        <div className="grid grid-cols-3 gap-2.5 animate-fade-in">
          <div className="rounded-lg border border-border bg-muted/20 p-3 text-center">
            <p className="text-lg font-black text-foreground">{formatCostUsd(result.totalCostUsd)}</p>
            <p className="text-[10px] text-muted-foreground">Custo USD</p>
          </div>
          <div className="rounded-lg border border-border bg-muted/20 p-3 text-center">
            <p className="text-lg font-black text-foreground">{formatCostBrl(result.totalCostBrl)}</p>
            <p className="text-[10px] text-muted-foreground">Custo BRL</p>
          </div>
          <div className="rounded-lg border border-border bg-muted/20 p-3 text-center">
            <p className="text-lg font-black text-foreground">{result.totalTokens.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground">Total Tokens</p>
          </div>
        </div>
      )}

      {showComparison && comparison.length > 0 && (
        <div className="animate-fade-in">
          <p className="text-[11px] font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Comparação de {comparison.length} modelos</p>
          <div className="space-y-1 max-h-[250px] overflow-auto">
            {comparison.map((c, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg border border-border bg-secondary/20 px-3 py-1.5">
                <span className="text-[10px] text-muted-foreground w-5">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium truncate">{c.provider}/{c.model}</p>
                </div>
                <Badge variant="outline" className="text-[10px]">{formatCostUsd(c.totalCostUsd)}</Badge>
                <span className="text-[10px] text-muted-foreground">{formatCostBrl(c.totalCostBrl)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
