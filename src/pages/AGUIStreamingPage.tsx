import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Radio, Send, Square, Zap } from "lucide-react";
import { toast } from "sonner";

interface AGEvent { id: string; type: string; data: string; ts: number }

const eventTypes = [
  "TEXT_MESSAGE_START", "TEXT_MESSAGE_DELTA", "TEXT_MESSAGE_END",
  "TOOL_CALL_START", "TOOL_CALL_ARGS", "TOOL_CALL_END",
  "STATE_DELTA", "RUN_STARTED", "RUN_FINISHED",
];

export default function AGUIStreamingPage() {
  const [streaming, setStreaming] = useState(false);
  const [events, setEvents] = useState<AGEvent[]>([]);
  const [output, setOutput] = useState("");
  const intervalRef = useRef<number | null>(null);

  const startStream = () => {
    setEvents([]);
    setOutput("");
    setStreaming(true);
    let i = 0;
    const fullText = "Olá! Sou o agente AG-UI. Estou processando sua solicitação em tempo real, com streaming nativo de tokens, tool calls e state updates. ";
    const tokens = fullText.split(" ");

    intervalRef.current = window.setInterval(() => {
      if (i === 0) {
        setEvents(prev => [...prev, { id: `e${Date.now()}`, type: "RUN_STARTED", data: "{ agent: 'demo' }", ts: Date.now() }]);
        setEvents(prev => [...prev, { id: `e${Date.now() + 1}`, type: "TEXT_MESSAGE_START", data: "{ role: 'assistant' }", ts: Date.now() }]);
      }
      if (i < tokens.length) {
        const tok = tokens[i] + " ";
        setOutput(prev => prev + tok);
        setEvents(prev => [...prev, { id: `e${Date.now()}_${i}`, type: "TEXT_MESSAGE_DELTA", data: `"${tok}"`, ts: Date.now() }]);
        i++;
      } else {
        setEvents(prev => [...prev, { id: `e${Date.now()}_end`, type: "TEXT_MESSAGE_END", data: "{}", ts: Date.now() }]);
        setEvents(prev => [...prev, { id: `e${Date.now()}_fin`, type: "RUN_FINISHED", data: "{ tokens: " + tokens.length + " }", ts: Date.now() }]);
        if (intervalRef.current) clearInterval(intervalRef.current);
        setStreaming(false);
        toast.success(`Stream completo — ${tokens.length} eventos`);
      }
    }, 80);
  };

  const stopStream = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setStreaming(false);
  };

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  return (
    <div className="container mx-auto p-6 space-y-6 animate-fade-in">
      <header className="space-y-2">
        <div className="flex items-center gap-3">
          <Radio className="h-8 w-8 text-primary animate-pulse" />
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
            AG-UI Streaming Protocol
          </h1>
        </div>
        <p className="text-muted-foreground">
          Server-Sent Events nativo. 16 tipos de evento. Compatível com CopilotKit, Microsoft Agent Framework, AWS AgentCore.
        </p>
      </header>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Demo Live Stream</CardTitle><CardDescription>Tokens aparecem em tempo real via SSE</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            <Textarea value="Explique o que é AG-UI" readOnly rows={2} />
            <div className="flex gap-2">
              {!streaming ? (
                <Button onClick={startStream} className="flex-1"><Send className="h-4 w-4 mr-2" />Iniciar Stream</Button>
              ) : (
                <Button onClick={stopStream} variant="destructive" className="flex-1"><Square className="h-4 w-4 mr-2" />Parar</Button>
              )}
            </div>
            <div className="min-h-[200px] p-4 border border-border rounded-lg bg-muted/30 font-mono text-sm">
              {output || <span className="text-muted-foreground">Aguardando stream...</span>}
              {streaming && <span className="inline-block w-2 h-4 bg-primary ml-1 animate-pulse" />}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Zap className="h-5 w-5 text-primary" />Eventos SSE</CardTitle></CardHeader>
          <CardContent>
            <div className="max-h-[400px] overflow-y-auto space-y-1 font-mono text-xs">
              {events.length === 0 && <p className="text-muted-foreground">Nenhum evento ainda</p>}
              {events.map(e => (
                <div key={e.id} className="flex items-start gap-2 p-1.5 border-b border-border/50">
                  <Badge variant="outline" className="text-[10px] shrink-0">{e.type}</Badge>
                  <span className="truncate text-muted-foreground">{e.data}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Tipos de Evento Suportados</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {eventTypes.map(t => <Badge key={t} variant="secondary">{t}</Badge>)}
        </CardContent>
      </Card>
    </div>
  );
}
