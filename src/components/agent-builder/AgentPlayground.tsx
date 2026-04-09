import { useState, useRef, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useAgentBuilderStore } from '@/stores/agentBuilderStore';
import { invokeLLMGateway } from '@/services/llmGatewayService';
import { useStreaming } from '@/hooks/useStreaming';
import { Send, MessageSquare, Trash2, Bug, Loader2, StopCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  metadata?: {
    model?: string;
    tokens?: { prompt: number; completion: number; total: number };
    latency_ms?: number;
    cost_usd?: number;
    provider?: string;
  };
}

export function AgentPlayground() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [streamMode] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const agent = useAgentBuilderStore((s) => s.agent);
  const streaming = useStreaming();

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const buildSystemPrompt = () => {
    const parts: string[] = [];
    if (agent.system_prompt) {
      parts.push(agent.system_prompt);
    } else {
      parts.push(`Você é ${agent.name || 'um assistente de IA'}.`);
      if (agent.mission) parts.push(`Missão: ${agent.mission}`);
      if (agent.persona) parts.push(`Persona: ${agent.persona}`);
    }
    const activeTools = agent.tools.filter(t => t.enabled);
    if (activeTools.length > 0) {
      parts.push(`\nFerramentas disponíveis: ${activeTools.map(t => t.name).join(', ')}`);
    }
    return parts.join('\n');
  };

  const sendMessage = async () => {
    if (!input.trim() || loading || streaming.isStreaming) return;
    const userMsg: ChatMessage = { role: 'user', content: input.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');

    const systemPrompt = buildSystemPrompt();
    const allMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: userMsg.content },
    ];

    if (streamMode) {
      // Streaming mode — add placeholder and update in real-time
      // Streaming mode — add placeholder and update in real-time
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);
      streaming.reset();
      await streaming.stream({
        model: agent.model || 'google/gemini-2.5-flash',
        messages: allMessages,
        temperature: agent.temperature ?? 0.7,
        max_tokens: agent.max_tokens ?? 4000,
        agent_id: agent.id as string || undefined,
      });
    } else {
      // Non-streaming mode
      setLoading(true);
      try {
        const data = await invokeLLMGateway({
          model: agent.model || 'google/gemini-2.5-flash',
          messages: allMessages,
          temperature: agent.temperature ?? 0.7,
          max_tokens: agent.max_tokens ?? 4000,
        });
        const res = data as Record<string, unknown>;
        setMessages(prev => [...prev, {
          role: 'assistant' as const, content: (res.content as string) || 'Sem resposta',
          metadata: { model: res.model as string, tokens: res.tokens as ChatMessage['metadata'] extends undefined ? never : { prompt: number; completion: number; total: number }, latency_ms: res.latency_ms as number, cost_usd: res.cost_usd as number, provider: res.provider as string },
        } satisfies ChatMessage]);
      } catch (e: unknown) {
        setMessages(prev => [...prev, { role: 'assistant', content: `❌ Erro: ${e instanceof Error ? e.message : 'Falha na chamada'}` }]);
      } finally { setLoading(false); }
    }
  };

  // Update last message with streaming content
  useEffect(() => {
    if (streaming.content && streaming.isStreaming) {
      setMessages(prev => {
        const copy = [...prev];
        const last = copy[copy.length - 1];
        if (last?.role === 'assistant') {
          copy[copy.length - 1] = { ...last, content: streaming.content };
        }
        return copy;
      });
    }
    if (!streaming.isStreaming && streaming.content) {
      setMessages(prev => {
        const copy = [...prev];
        const last = copy[copy.length - 1];
        if (last?.role === 'assistant') {
          copy[copy.length - 1] = {
            ...last, content: streaming.content,
            metadata: { model: streaming.model, provider: streaming.provider, tokens: streaming.tokens, cost_usd: streaming.costUsd, latency_ms: streaming.latencyMs },
          };
        }
        return copy;
      });
    }
  }, [streaming.content, streaming.isStreaming]);

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 h-12 w-12 rounded-full nexus-gradient-bg text-primary-foreground shadow-lg hover:opacity-90"
        size="icon"
        title="Testar Agente"
      >
        <MessageSquare className="h-5 w-5" />
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-[500px] sm:w-[550px] p-0 flex flex-col">
          <SheetHeader className="px-5 pt-5 pb-3 border-b border-border/50 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">{agent.avatar_emoji || '🤖'}</span>
                <div>
                  <SheetTitle className="text-sm font-heading font-bold text-foreground">{agent.name || 'Agente'}</SheetTitle>
                  <p className="text-[11px] text-muted-foreground">{agent.model} • Playground</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDebugMode(!debugMode)} title="Debug mode">
                  <Bug className={`h-3.5 w-3.5 ${debugMode ? 'text-primary' : 'text-muted-foreground'}`} />
                </Button>
                {streaming.isStreaming && (
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => streaming.cancel()} title="Parar geração">
                    <StopCircle className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                )}
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setMessages([])} title="Limpar conversa">
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </div>
            </div>
          </SheetHeader>

          {debugMode && (
            <div className="px-5 py-2 bg-secondary/30 border-b border-border/50 shrink-0">
              <p className="text-[11px] font-mono text-muted-foreground">System Prompt:</p>
              <pre className="text-[11px] text-foreground font-mono whitespace-pre-wrap max-h-32 overflow-y-auto mt-1">
                {buildSystemPrompt()}
              </pre>
            </div>
          )}

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <MessageSquare className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">Envie uma mensagem para testar o agente</p>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i}>
                <div className={`rounded-xl p-3 text-sm ${
                  msg.role === 'user'
                    ? 'bg-primary/10 text-foreground ml-8'
                    : 'bg-secondary/50 text-foreground mr-4'
                }`}>
                  <p className="text-[11px] font-medium text-muted-foreground mb-1">
                    {msg.role === 'user' ? 'Você' : agent.name || 'Assistente'}
                  </p>
                  {msg.role === 'user' ? (
                    <div className="whitespace-pre-wrap text-xs leading-relaxed">{msg.content}</div>
                  ) : (
                    <div className="prose prose-sm prose-invert max-w-none text-xs leading-relaxed [&_p]:mb-1.5 [&_ul]:mb-1.5 [&_ol]:mb-1.5 [&_pre]:bg-background/50 [&_pre]:rounded-md [&_pre]:p-2 [&_code]:text-[11px] [&_h1]:text-sm [&_h2]:text-xs [&_h3]:text-xs [&_li]:text-xs">
                      <ReactMarkdown>{msg.content || '...'}</ReactMarkdown>
                    </div>
                  )}
                </div>
                {msg.metadata && (
                  <div className="flex items-center gap-2 mt-1 ml-1">
                    {msg.metadata.model && <Badge variant="outline" className="text-[11px] h-4">{msg.metadata.provider || msg.metadata.model}</Badge>}
                    {msg.metadata.tokens && <span className="text-[11px] text-muted-foreground">{msg.metadata.tokens.total} tokens</span>}
                    {msg.metadata.latency_ms && <span className="text-[11px] text-muted-foreground">{(msg.metadata.latency_ms / 1000).toFixed(1)}s</span>}
                    {msg.metadata.cost_usd != null && <span className="text-[11px] text-muted-foreground">${msg.metadata.cost_usd.toFixed(4)}</span>}
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-2 text-muted-foreground ml-1">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-xs">Pensando...</span>
              </div>
            )}
          </div>

          <div className="px-5 py-3 border-t border-border/50 shrink-0">
            <div className="flex items-end gap-2">
              <Textarea
                placeholder="Digite sua mensagem..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                className="min-h-[40px] max-h-[120px] text-xs bg-secondary/50 border-border/50 resize-none"
                rows={1}
              />
              <Button size="icon" onClick={sendMessage} disabled={!input.trim() || loading} className="shrink-0 nexus-gradient-bg text-primary-foreground hover:opacity-90 h-10 w-10">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
