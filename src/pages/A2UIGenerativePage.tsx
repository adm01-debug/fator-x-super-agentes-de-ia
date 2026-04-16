import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Layout, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";

type WidgetType = "form" | "table" | "chart" | "card" | "wizard";

interface GenerativeWidget {
  type: WidgetType;
  title: string;
  payload: Record<string, unknown>;
}

const examples: Record<string, GenerativeWidget> = {
  "Crie um form de cadastro de cliente": {
    type: "form",
    title: "Cadastro de Cliente",
    payload: { fields: ["Nome", "Email", "Telefone", "Empresa"] }
  },
  "Mostre uma tabela com pedidos do mês": {
    type: "table",
    title: "Pedidos — Abril/2026",
    payload: { columns: ["ID", "Cliente", "Valor", "Status"], rows: 12 }
  },
  "Visualize vendas dos últimos 7 dias": {
    type: "chart",
    title: "Vendas — Últimos 7 dias",
    payload: { type: "bar", data: [12, 19, 8, 15, 22, 18, 25] }
  },
};

export default function A2UIGenerativePage() {
  const [prompt, setPrompt] = useState("");
  const [widget, setWidget] = useState<GenerativeWidget | null>(null);

  const generate = () => {
    const matched = Object.entries(examples).find(([k]) => prompt.toLowerCase().includes(k.toLowerCase().slice(5, 15)));
    if (matched) {
      setWidget(matched[1]);
      toast.success(`Widget "${matched[1].type}" gerado pelo agente`);
    } else {
      const random = Object.values(examples)[Math.floor(Math.random() * Object.values(examples).length)];
      setWidget(random);
      toast.success(`Widget "${random.type}" gerado`);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6 animate-fade-in">
      <header className="space-y-2">
        <div className="flex items-center gap-3">
          <Layout className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
            A2UI — Generative UI
          </h1>
        </div>
        <p className="text-muted-foreground">
          Agentes geram componentes de UI dinamicamente. Forms, tabelas, charts, wizards — não só texto. Spec Google + CopilotKit.
        </p>
      </header>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" />Solicite um Widget</CardTitle><CardDescription>O agente decide qual componente renderizar</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          <Textarea placeholder="Ex: Crie um form de cadastro de cliente..." value={prompt} onChange={e => setPrompt(e.target.value)} rows={3} />
          <div className="flex flex-wrap gap-2">
            {Object.keys(examples).map(k => (
              <Button key={k} size="sm" variant="outline" onClick={() => setPrompt(k)}>{k}</Button>
            ))}
          </div>
          <Button onClick={generate} className="w-full"><Send className="h-4 w-4 mr-2" />Gerar UI</Button>
        </CardContent>
      </Card>

      {widget && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{widget.title}</CardTitle>
              <Badge>{widget.type}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {widget.type === "form" && (
              <div className="space-y-3">
                {(widget.payload.fields as string[]).map(f => (
                  <div key={f}><Label>{f}</Label><Input placeholder={f} /></div>
                ))}
                <Button onClick={() => toast.success("Form enviado ao agente")}>Enviar</Button>
              </div>
            )}
            {widget.type === "table" && (
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border">{(widget.payload.columns as string[]).map(c => <th key={c} className="text-left p-2">{c}</th>)}</tr></thead>
                <tbody>
                  {Array.from({ length: widget.payload.rows as number }).map((_, i) => (
                    <tr key={i} className="border-b border-border/40">
                      <td className="p-2 font-mono">#{4500 + i}</td>
                      <td className="p-2">Cliente {i + 1}</td>
                      <td className="p-2">R$ {(Math.random() * 5000).toFixed(2)}</td>
                      <td className="p-2"><Badge variant="outline">Pago</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {widget.type === "chart" && (
              <div className="flex items-end gap-2 h-40">
                {(widget.payload.data as number[]).map((v, i) => (
                  <div key={i} className="flex-1 bg-gradient-to-t from-primary to-primary-glow rounded-t" style={{ height: `${(v / 25) * 100}%` }} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
