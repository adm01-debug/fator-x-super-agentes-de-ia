/**
 * Conversational Builder — chat-to-agent wizard via Lovable AI.
 * Faz perguntas e auto-preenche o agente em tempo real.
 */
import { useState, useRef, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sparkles, Send, Loader2, Check } from 'lucide-react';
import { useAgentBuilderStore } from '@/stores/agentBuilderStore';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

interface Msg {
  role: 'user' | 'assistant';
  content: string;
}

interface ConversationalBuilderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ConversationalBuilder({ open, onOpenChange }: ConversationalBuilderProps) {
  const { agent, updateAgent } = useAgentBuilderStore();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([
        {
          role: 'assistant',
          content: '👋 Oi! Vou te ajudar a montar seu agente em poucos minutos. **Qual é o objetivo principal dele?** (ex: atendimento ao cliente, análise de vendas, escrita criativa…)',
        },
      ]);
    }
  }, [open, messages.length]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    setLoading(true);

    const newMessages: Msg[] = [...messages, { role: 'user', content: text }];
    setMessages(newMessages);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/agent-conversational-builder`;

      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ messages: newMessages, currentAgent: agent }),
      });

      if (!resp.ok || !resp.body) {
        const err = await resp.json().catch(() => ({ error: resp.statusText }));
        throw new Error(err.error || 'Falha na chamada');
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let assistantText = '';
      let toolArgsBuffer = '';
      let inToolCall = false;
      setMessages([...newMessages, { role: 'assistant', content: '' }]);

      while (true) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;
        buffer += decoder.decode(value, { stream: true });

        let nl: number;
        while ((nl = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, nl);
          buffer = buffer.slice(nl + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (!line.startsWith('data: ')) continue;
          const json = line.slice(6).trim();
          if (json === '[DONE]') continue;

          try {
            const parsed = JSON.parse(json);
            const delta = parsed.choices?.[0]?.delta;
            if (!delta) continue;

            if (delta.content) {
              assistantText += delta.content;
              setMessages((prev) => {
                const copy = [...prev];
                copy[copy.length - 1] = { role: 'assistant', content: assistantText };
                return copy;
              });
            }

            const tc = delta.tool_calls?.[0];
            if (tc?.function?.arguments) {
              inToolCall = true;
              toolArgsBuffer += tc.function.arguments;
            }
          } catch {
            buffer = line + '\n' + buffer;
            break;
          }
        }
      }

      // Apply tool call patch
      if (inToolCall && toolArgsBuffer) {
        try {
          const args = JSON.parse(toolArgsBuffer);
          if (args.patch && typeof args.patch === 'object') {
            updateAgent(args.patch);
            const fields = Object.keys(args.patch).join(', ');
            toast.success(`✨ Atualizado: ${fields}`);
          }
          if (args.done) {
            setDone(true);
            toast.success('🎉 Agente pronto! Revise e salve.');
          }
        } catch (err) {
          logger.warn('Failed to parse tool args', err);
        }
      }

      // Empty assistant fallback
      if (!assistantText && !inToolCall) {
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: 'assistant', content: '✓' };
          return copy;
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro';
      toast.error(msg);
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setMessages([]);
    setDone(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="px-5 py-4 border-b shrink-0">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            Builder Conversacional
          </SheetTitle>
          <SheetDescription className="text-xs">
            Converse e seu agente é montado em tempo real.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 px-5 py-4" ref={scrollRef}>
          <div className="space-y-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap ${
                    m.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground'
                  }`}
                >
                  {m.content || (loading && i === messages.length - 1 ? '…' : '')}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="px-5 py-3 border-t shrink-0 space-y-2 bg-background">
          {done && (
            <Button
              size="sm"
              className="w-full"
              onClick={() => onOpenChange(false)}
            >
              <Check className="h-3.5 w-3.5 mr-1.5" />
              Aplicar e fechar
            </Button>
          )}
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
              placeholder="Sua resposta…"
              disabled={loading}
              className="text-sm"
            />
            <Button size="icon" onClick={handleSend} disabled={loading || !input.trim()}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
          {messages.length > 1 && (
            <Button variant="ghost" size="sm" onClick={handleReset} className="w-full text-xs h-7">
              Recomeçar conversa
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
