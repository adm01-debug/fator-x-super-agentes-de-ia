import { useState } from "react";
import { Cpu, Upload, Play, CheckCircle2, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/shared/PageHeader";
import { toast } from "sonner";

type Job = { id: string; name: string; baseModel: string; method: string; status: "pending" | "training" | "completed" | "failed"; progress: number; loss: number; epoch: number };

const JOBS: Job[] = [
  { id: "ft-001", name: "support-bot-v3", baseModel: "llama-3.1-8b", method: "LoRA r=16", status: "training", progress: 67, loss: 0.42, epoch: 2 },
  { id: "ft-002", name: "legal-classifier", baseModel: "mistral-7b", method: "QLoRA 4-bit", status: "completed", progress: 100, loss: 0.18, epoch: 3 },
  { id: "ft-003", name: "ptbr-summarizer", baseModel: "qwen-2.5-7b", method: "Full FT", status: "completed", progress: 100, loss: 0.31, epoch: 4 },
];

export default function FineTuningPage() {
  const [method, setMethod] = useState("lora");
  const [rank, setRank] = useState([16]);
  const [epochs, setEpochs] = useState([3]);
  const [lr, setLr] = useState([2]);

  return (
    <div className="p-6 sm:p-8 lg:p-10 space-y-6 max-w-[1400px] mx-auto animate-page-enter">
      <PageHeader title="Fine-Tuning No-Code" description="Treine modelos customizados com LoRA, QLoRA ou Full Fine-Tuning. Sem código, sem GPU local." />
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-4">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Sparkles className="h-4 w-4" />Novo treinamento</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Nome</Label><Input placeholder="my-bot-v1" className="mt-1" /></div>
              <div>
                <Label className="text-xs">Modelo base</Label>
                <Select defaultValue="llama"><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="llama">Llama 3.1 8B</SelectItem>
                    <SelectItem value="mistral">Mistral 7B v0.3</SelectItem>
                    <SelectItem value="qwen">Qwen 2.5 7B</SelectItem>
                    <SelectItem value="gemma">Gemma 2 9B</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Dataset</Label>
              <div className="mt-1 border-2 border-dashed border-border/50 rounded-md p-6 text-center cursor-pointer hover:border-primary/50">
                <Upload className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                <div className="text-sm">Upload dataset (.jsonl)</div>
                <div className="text-[11px] text-muted-foreground mt-1">{`{prompt, completion}`} — mínimo 50 exemplos</div>
              </div>
            </div>
            <div>
              <Label className="text-xs mb-2 block">Método</Label>
              <div className="grid grid-cols-3 gap-2">
                {[{ id: "lora", name: "LoRA", desc: "Rápido" }, { id: "qlora", name: "QLoRA", desc: "4-bit" }, { id: "full", name: "Full FT", desc: "Máxima qualidade" }].map((m) => (
                  <button key={m.id} onClick={() => setMethod(m.id)} className={`p-2.5 rounded-md border text-left transition-all ${method === m.id ? "border-primary bg-primary/8" : "border-border/40"}`}>
                    <div className="text-sm font-semibold">{m.name}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{m.desc}</div>
                  </button>
                ))}
              </div>
            </div>
            {method !== "full" && (
              <div><div className="flex justify-between text-xs mb-1.5"><Label>LoRA Rank</Label><span className="font-mono">{rank[0]}</span></div><Slider value={rank} onValueChange={setRank} min={4} max={64} step={4} /></div>
            )}
            <div><div className="flex justify-between text-xs mb-1.5"><Label>Epochs</Label><span className="font-mono">{epochs[0]}</span></div><Slider value={epochs} onValueChange={setEpochs} min={1} max={10} step={1} /></div>
            <div><div className="flex justify-between text-xs mb-1.5"><Label>Learning rate</Label><span className="font-mono">{lr[0]}e-4</span></div><Slider value={lr} onValueChange={setLr} min={1} max={10} step={1} /></div>
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded text-xs"><span>Custo estimado</span><span className="font-bold">$12.40 · ~45 min</span></div>
            <Button className="w-full" onClick={() => toast.success("Treinamento enviado")}><Play className="h-4 w-4 mr-2" />Iniciar fine-tuning</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Cpu className="h-4 w-4" />Jobs</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {JOBS.map((j) => (
              <div key={j.id} className="p-3 bg-muted/20 rounded-md space-y-2">
                <div className="flex items-center justify-between">
                  <div><div className="text-sm font-semibold">{j.name}</div><div className="text-[11px] text-muted-foreground">{j.baseModel} · {j.method}</div></div>
                  {j.status === "completed" && <Badge className="bg-nexus-green/15 text-nexus-green text-[10px]"><CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />Pronto</Badge>}
                  {j.status === "training" && <Badge className="bg-nexus-blue/15 text-nexus-blue text-[10px]">Treinando</Badge>}
                </div>
                <Progress value={j.progress} className="h-1.5" />
                <div className="flex justify-between text-[10px] text-muted-foreground font-mono"><span>Epoch {j.epoch}/{epochs[0]}</span><span>Loss: {j.loss}</span><span>{j.progress}%</span></div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
