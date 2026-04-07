import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Code2, Copy, Send, Loader2, CheckCircle2, XCircle, Globe } from "lucide-react";
import { toast } from "sonner";
import {
  buildWidgetEmbedSnippet,
  sendWidgetChatMessage,
  checkWidgetEndpointAvailable,
} from "@/services/widgetService";

interface WebWidgetPanelProps {
  agentId?: string;
  agentName?: string;
}

export function WebWidgetPanel({ agentId: initialAgentId, agentName }: WebWidgetPanelProps) {
  const [agentId, setAgentId] = useState(initialAgentId ?? "");
  const [testMessage, setTestMessage] = useState("Olá, esta é uma mensagem de teste do widget.");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatReply, setChatReply] = useState<string | null>(null);
  const [pingLoading, setPingLoading] = useState(false);
  const [pingResult, setPingResult] = useState<boolean | null>(null);

  const snippet = agentId ? buildWidgetEmbedSnippet(agentId) : null;

  const handleCopy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copiado`);
    } catch {
      toast.error("Falha ao copiar");
    }
  };

  const handlePing = async () => {
    if (!agentId.trim()) {
      toast.error("Informe o agent_id");
      return;
    }
    setPingLoading(true);
    setPingResult(null);
    try {
      const ok = await checkWidgetEndpointAvailable(agentId.trim());
      setPingResult(ok);
      toast[ok ? "success" : "error"](
        ok ? "Endpoint widget disponível" : "Endpoint widget indisponível"
      );
    } finally {
      setPingLoading(false);
    }
  };

  const handleTestChat = async () => {
    if (!agentId.trim() || !testMessage.trim()) {
      toast.error("agent_id e mensagem são obrigatórios");
      return;
    }
    setChatLoading(true);
    setChatReply(null);
    try {
      const result = await sendWidgetChatMessage({
        agent_id: agentId.trim(),
        message: testMessage.trim(),
      });
      setChatReply(result.reply ?? JSON.stringify(result));
      toast.success("Resposta recebida");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no chat de teste");
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <Card className="bg-[#111122] border-[#222244]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Globe className="h-4 w-4 text-[#4D96FF]" />
          Web Widget Embed
          {agentName && <Badge variant="outline" className="text-[10px] border-[#222244]">{agentName}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="widget-agent-id">Agent ID</Label>
          <div className="flex gap-2">
            <Input
              id="widget-agent-id"
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              placeholder="uuid do agente"
              className="bg-[#0a0a1a] border-[#222244] font-mono text-xs"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handlePing}
              disabled={pingLoading || !agentId.trim()}
              className="border-[#222244] gap-1.5 shrink-0"
            >
              {pingLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : pingResult === true ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
              ) : pingResult === false ? (
                <XCircle className="h-3.5 w-3.5 text-red-400" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              Ping
            </Button>
          </div>
        </div>

        {snippet && (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2"><Code2 className="h-3.5 w-3.5" /> Snippet HTML</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopy(snippet.htmlSnippet, "Snippet")}
                  className="h-6 text-[10px] gap-1"
                >
                  <Copy className="h-3 w-3" /> Copiar
                </Button>
              </div>
              <pre className="p-3 rounded-lg bg-[#0a0a1a] border border-[#222244] text-[11px] font-mono text-gray-300 overflow-x-auto">
                {snippet.htmlSnippet}
              </pre>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Script URL</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopy(snippet.scriptUrl, "URL")}
                  className="h-6 text-[10px] gap-1"
                >
                  <Copy className="h-3 w-3" /> Copiar
                </Button>
              </div>
              <code className="block p-2 rounded bg-[#0a0a1a] border border-[#222244] text-[10px] font-mono text-gray-400 break-all">
                {snippet.scriptUrl}
              </code>
            </div>

            <div className="pt-3 border-t border-[#222244] space-y-2">
              <Label htmlFor="widget-test-msg">Testar chat do widget</Label>
              <Textarea
                id="widget-test-msg"
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                rows={2}
                className="bg-[#0a0a1a] border-[#222244] text-xs resize-none"
              />
              <Button
                onClick={handleTestChat}
                disabled={chatLoading}
                size="sm"
                className="bg-[#4D96FF] hover:bg-[#4D96FF]/90 text-white gap-1.5"
              >
                {chatLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                Enviar Teste
              </Button>

              {chatReply && (
                <div className="mt-3 p-3 rounded-lg bg-[#0a0a1a] border border-[#4D96FF]/30">
                  <p className="text-[10px] text-[#4D96FF] uppercase tracking-wider mb-1">Resposta do Agent</p>
                  <p className="text-xs text-gray-200 whitespace-pre-wrap">{chatReply}</p>
                </div>
              )}
            </div>
          </>
        )}

        {!snippet && (
          <p className="text-xs text-gray-500 italic">
            Informe o Agent ID acima para gerar o snippet de embed e testar o widget.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
