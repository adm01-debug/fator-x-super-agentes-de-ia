import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function AutoExtractionTab() {
  const [text, setText] = useState('');
  const [extractType, setExtractType] = useState('entities');
  const [isExtracting, setIsExtracting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleExtract = async () => {
    if (!text.trim()) return;
    setIsExtracting(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('cerebro-brain', {
        body: { action: 'auto_extract', text, extract_type: extractType },
      });
      if (error) throw error;
      const meta = data?.cost_usd ? `\n\n---\n_Custo: $${data.cost_usd.toFixed(6)}_` : '';
      setResult((data?.extracted || 'Nenhuma extração') + meta);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro na extração');
    } finally {
      setIsExtracting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-heading font-semibold text-foreground flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" /> Extração Automática via LLM
        </h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">Cole um texto e extraia entidades, fatos, regras ou contatos automaticamente</p>
      </div>

      <div className="nexus-card space-y-4">
        <div className="flex gap-3 items-end">
          <div className="flex-1 space-y-1.5">
            <label className="text-[11px] text-muted-foreground font-medium">Tipo de extração</label>
            <Select value={extractType} onValueChange={setExtractType}>
              <SelectTrigger className="bg-secondary/50 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="entities">🏢 Entidades (pessoas, empresas, produtos)</SelectItem>
                <SelectItem value="facts">📊 Fatos e informações</SelectItem>
                <SelectItem value="rules">📋 Regras de negócio</SelectItem>
                <SelectItem value="contacts">📞 Contatos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Cole aqui o texto de um email, documento, ata de reunião, contrato..."
          className="bg-secondary/50 min-h-[120px] text-sm"
        />

        <div className="flex justify-between items-center">
          <p className="text-[11px] text-muted-foreground">{text.length} caracteres</p>
          <Button onClick={handleExtract} disabled={isExtracting || !text.trim()} className="nexus-gradient-bg text-primary-foreground gap-2">
            {isExtracting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            {isExtracting ? 'Extraindo...' : 'Extrair'}
          </Button>
        </div>

        {result && (
          <div className="p-4 rounded-lg bg-secondary/30 border border-border/30">
            <p className="text-xs font-semibold text-foreground mb-2">Resultado da Extração ({extractType}):</p>
            <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{result}</div>
          </div>
        )}
      </div>
    </div>
  );
}
