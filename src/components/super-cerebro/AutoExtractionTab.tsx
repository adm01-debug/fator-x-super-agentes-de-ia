import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Zap, ClipboardPaste, Save, Trash2, Sparkles } from "lucide-react";
import { invokeCerebroBrain } from "@/services/cerebroService";
import { addMemory } from "@/services/memoryService";
import { toast } from "sonner";

const EXTRACT_TYPES = [
  { value: 'entities', label: '🏢 Entidades (pessoas, empresas, produtos)' },
  { value: 'facts', label: '📊 Fatos e informações' },
  { value: 'rules', label: '📋 Regras de negócio' },
  { value: 'contacts', label: '📞 Contatos' },
  { value: 'dates', label: '📅 Datas e prazos' },
  { value: 'monetary', label: '💰 Valores monetários' },
  { value: 'tasks', label: '✅ Tarefas e ações' },
  { value: 'risks', label: '⚠️ Riscos e bloqueios' },
];

const EXAMPLES: Record<string, string> = {
  entities: 'Acabamos de fechar contrato com a Promo Brindes via João Silva (Diretor Comercial) para entrega de 5.000 canetas personalizadas.',
  facts: 'Em 2024, a empresa cresceu 32% em receita, atingindo R$ 8,2 milhões com margem de 18%.',
  rules: 'Pedidos acima de R$ 50.000 precisam de aprovação do diretor financeiro. Pagamentos só são liberados após confirmação fiscal.',
  contacts: 'Maria Santos, gerente de compras, maria.santos@empresa.com.br, (11) 98765-4321, ramal 2341',
};

export function AutoExtractionTab() {
  const [text, setText] = useState('');
  const [extractType, setExtractType] = useState('entities');
  const [isExtracting, setIsExtracting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [costUsd, setCostUsd] = useState<number | null>(null);
  const [savingToMemory, setSavingToMemory] = useState(false);

  const handleExtract = async () => {
    if (!text.trim()) return;
    setIsExtracting(true);
    setResult(null);
    setCostUsd(null);
    try {
      const data = await invokeCerebroBrain({ action: 'auto_extract', text, extract_type: extractType });
      setResult(data?.extracted || 'Nenhuma extração');
      setCostUsd(typeof data?.cost_usd === 'number' ? data.cost_usd : null);
      toast.success('Extração concluída');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro na extração');
    } finally {
      setIsExtracting(false);
    }
  };

  const handlePaste = async () => {
    try {
      const clipText = await navigator.clipboard.readText();
      if (clipText) {
        setText(clipText);
        toast.success('Texto colado da área de transferência');
      }
    } catch {
      toast.error('Não foi possível ler a área de transferência');
    }
  };

  const handleSaveToMemory = async () => {
    if (!result) return;
    setSavingToMemory(true);
    try {
      const memoryType = extractType === 'rules' ? 'procedural' : 'semantic';
      await addMemory(
        `[${EXTRACT_TYPES.find((e) => e.value === extractType)?.label ?? extractType}]\n${result}`,
        memoryType,
        'Auto-Extraction'
      );
      toast.success('Salvo na memória do Super Cérebro');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao salvar');
    } finally {
      setSavingToMemory(false);
    }
  };

  const handleLoadExample = () => {
    const ex = EXAMPLES[extractType];
    if (ex) {
      setText(ex);
      toast.info('Exemplo carregado');
    }
  };

  const handleClear = () => {
    setText('');
    setResult(null);
    setCostUsd(null);
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-heading font-semibold text-foreground flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" /> Extração Automática via LLM
        </h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Cole texto e extraia entidades, fatos, regras, contatos, datas, valores, tarefas ou riscos automaticamente
        </p>
      </div>

      <div className="nexus-card space-y-4">
        <div className="flex gap-3 items-end flex-wrap">
          <div className="flex-1 min-w-[220px] space-y-1.5">
            <label className="text-[11px] text-muted-foreground font-medium">Tipo de extração</label>
            <Select value={extractType} onValueChange={setExtractType}>
              <SelectTrigger className="bg-secondary/50 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXTRACT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" size="sm" onClick={handlePaste} className="gap-1.5 h-9 text-xs">
            <ClipboardPaste className="h-3.5 w-3.5" /> Colar
          </Button>
          {EXAMPLES[extractType] && (
            <Button variant="outline" size="sm" onClick={handleLoadExample} className="gap-1.5 h-9 text-xs">
              <Sparkles className="h-3.5 w-3.5" /> Exemplo
            </Button>
          )}
          {(text || result) && (
            <Button variant="outline" size="sm" onClick={handleClear} className="gap-1.5 h-9 text-xs">
              <Trash2 className="h-3.5 w-3.5" /> Limpar
            </Button>
          )}
        </div>

        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Cole aqui o texto de um email, documento, ata de reunião, contrato..."
          className="bg-secondary/50 min-h-[120px] text-sm"
        />

        <div className="flex justify-between items-center">
          <p className="text-[11px] text-muted-foreground">{text.length} caracteres</p>
          <Button
            onClick={handleExtract}
            disabled={isExtracting || !text.trim()}
            className="nexus-gradient-bg text-primary-foreground gap-2"
          >
            {isExtracting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            {isExtracting ? 'Extraindo...' : 'Extrair'}
          </Button>
        </div>

        {result && (
          <div className="p-4 rounded-lg bg-secondary/30 border border-border/30 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-foreground">
                Resultado ({EXTRACT_TYPES.find((t) => t.value === extractType)?.label ?? extractType})
              </p>
              {costUsd != null && (
                <span className="text-[10px] text-muted-foreground font-mono">
                  Custo: ${costUsd.toFixed(6)}
                </span>
              )}
            </div>
            <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{result}</div>
            <div className="flex justify-end pt-2 border-t border-border/30">
              <Button
                size="sm"
                variant="outline"
                onClick={handleSaveToMemory}
                disabled={savingToMemory}
                className="gap-1.5 text-xs h-7"
              >
                {savingToMemory ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                Salvar na Memória
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
