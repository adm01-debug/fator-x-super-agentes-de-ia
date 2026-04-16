import { useState } from "react";
import { Database, Wand2, Download, Shuffle, FileJson, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/shared/PageHeader";
import { toast } from "sonner";

export default function SyntheticDataPage() {
  const [count, setCount] = useState([500]);
  const [generated, setGenerated] = useState<Array<{ prompt: string; completion: string }>>([]);
  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(false);

  const generate = async () => {
    setRunning(true);
    setProgress(0);
    setGenerated([]);
    const samples = [
      { prompt: "Como cancelo minha assinatura?", completion: "Para cancelar, acesse Configurações > Plano e clique em Cancelar." },
      { prompt: "Qual o prazo de entrega?", completion: "O prazo padrão é de 5-7 dias úteis para todo Brasil." },
      { prompt: "Como solicito reembolso?", completion: "Você pode solicitar em até 30 dias via central de ajuda." },
    ];
    for (let i = 0; i < 6; i++) {
      await new Promise((r) => setTimeout(r, 400));
      setProgress((i + 1) * (100 / 6));
      setGenerated((prev) => [...prev, samples[i % samples.length]]);
    }
    setRunning(false);
    toast.success(`${count[0]} exemplos gerados`, { description: "Dataset pronto para download" });
  };

  return (
    <div className="p-6 sm:p-8 lg:p-10 space-y-6 max-w-[1400px] mx-auto animate-page-enter">
      <PageHeader
        title="Synthetic Data Generation"
        description="Gere datasets sintéticos para treinamento — Q&A, classificação, instruction-tuning. Powered by Mixtral + auto-evaluation."
      />

      <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-4">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Wand2 className="h-4 w-4" />Configuração</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-xs">Tipo de dataset</Label>
              <Select defaultValue="qa">
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="qa">Q&A (pergunta/resposta)</SelectItem>
                  <SelectItem value="classification">Classificação multi-label</SelectItem>
                  <SelectItem value="instruction">Instruction-tuning (Alpaca)</SelectItem>
                  <SelectItem value="dialog">Diálogo multi-turn</SelectItem>
                  <SelectItem value="ner">NER (entidades)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Domínio / contexto</Label>
              <Textarea placeholder="Ex: Atendimento ao cliente de e-commerce brasileiro, foco em logística, devoluções e pagamentos." className="mt-1 min-h-[100px]" />
            </div>

            <div>
              <Label className="text-xs">Modelo gerador</Label>
              <Select defaultValue="mixtral">
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mixtral">Mixtral 8x7B (recomendado)</SelectItem>
                  <SelectItem value="gpt4">GPT-4o (alta qualidade)</SelectItem>
                  <SelectItem value="claude">Claude Sonnet 4</SelectItem>
                  <SelectItem value="gemini">Gemini 2.5 Pro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1.5"><Label>Quantidade de exemplos</Label><span className="font-mono">{count[0]}</span></div>
              <Slider value={count} onValueChange={setCount} min={50} max={5000} step={50} />
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 bg-muted/30 rounded">
                <div className="text-muted-foreground">Custo</div>
                <div className="font-bold">${(count[0] * 0.002).toFixed(2)}</div>
              </div>
              <div className="p-2.5 bg-muted/30 rounded">
                <div className="text-muted-foreground">Tempo</div>
                <div className="font-bold">~{Math.ceil(count[0] / 100)} min</div>
              </div>
            </div>

            <Button className="w-full" onClick={generate} disabled={running}>
              <Sparkles className="h-4 w-4 mr-2" />{running ? "Gerando..." : "Gerar dataset"}
            </Button>
            {running && <Progress value={progress} className="h-1.5" />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3 flex-row items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2"><FileJson className="h-4 w-4" />Preview</CardTitle>
            {generated.length > 0 && (
              <div className="flex gap-2">
                <Button size="sm" variant="outline"><Shuffle className="h-3.5 w-3.5 mr-1" />Embaralhar</Button>
                <Button size="sm"><Download className="h-3.5 w-3.5 mr-1" />.jsonl</Button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {generated.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-16">
                <Database className="h-10 w-10 mx-auto mb-2 opacity-30" />
                Configure e gere seu dataset
              </div>
            ) : (
              <div className="space-y-2">
                {generated.map((s, i) => (
                  <div key={i} className="p-3 bg-muted/30 rounded text-xs space-y-1.5 font-mono">
                    <div><Badge variant="outline" className="text-[10px] mr-2">prompt</Badge>{s.prompt}</div>
                    <div><Badge variant="outline" className="text-[10px] mr-2 bg-primary/10">completion</Badge>{s.completion}</div>
                  </div>
                ))}
                {generated.length > 0 && <div className="text-center text-xs text-muted-foreground pt-2">+ {count[0] - generated.length} exemplos serão gerados</div>}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
