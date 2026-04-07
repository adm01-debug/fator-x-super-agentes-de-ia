/**
 * StreamingChat — Token-by-token chat with AG-UI event display.
 * Shows tokens appearing in real-time, tool call progress, and state updates.
 */
import { useState, useRef, useEffect } from 'react';
import { useStreamingResponse } from '@/hooks/useStreamingResponse';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Send, Square, Zap, Clock, Hash } from 'lucide-react';

interface StreamingChatProps {
  endpoint: string;
  placeholder?: string;
  buildBody?: (message: string) => Record<string, unknown>;
  className?: string;
}

export function StreamingChat({ endpoint, placeholder = 'Digite sua mensagem...', buildBody, className = '' }: StreamingChatProps) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { text, tokens, isStreaming, isComplete, error, latencyMs, toolCalls, stream, cancel, reset } = useStreamingResponse();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [text, messages]);

  async function handleSend() {
    if (!input.trim() || isStreaming) return;
    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);

    const body = buildBody ? buildBody(userMsg) : { messages: [...messages, { role: 'user', content: userMsg }] };

    await stream(endpoint, body, {
      onComplete: (fullText) => {
        setMessages(prev => [...prev, { role: 'assistant', content: fullText }]);
        reset();
      },
    });
  }

  return (
    <div className={`flex flex-col h-full bg-background rounded-xl border border-border ${className}`}>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
              msg.role === 'user' ? 'bg-primary/20 text-foreground' : 'bg-muted text-foreground'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}

        {/* Streaming response */}
        {isStreaming && text && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-lg px-3 py-2 text-sm bg-muted text-foreground">
              {text}
              <span className="animate-pulse text-primary">▌</span>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-2 text-xs text-destructive">{error}</div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Streaming metrics bar */}
      {(isStreaming || isComplete) && (
        <div className="px-4 py-1.5 border-t border-border flex items-center gap-3 text-[10px] text-muted-foreground">
          {isStreaming && <Badge className="bg-primary/20 text-primary text-[10px] animate-pulse">● STREAMING</Badge>}
          <span className="flex items-center gap-1"><Hash className="w-3 h-3" />{tokens} tokens</span>
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{latencyMs}ms</span>
          {toolCalls.length > 0 && <span className="flex items-center gap-1"><Zap className="w-3 h-3" />{toolCalls.length} tools</span>}
        </div>
      )}

      {/* Input */}
      <div className="p-3 border-t border-border flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
          placeholder={placeholder}
          disabled={isStreaming}
          aria-label="Mensagem para o assistente"
          className="flex-1 bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        />
        {isStreaming ? (
          <Button onClick={cancel} variant="destructive" size="sm" aria-label="Parar streaming"><Square className="w-3 h-3" /></Button>
        ) : (
          <Button onClick={handleSend} disabled={!input.trim()} size="sm" aria-label="Enviar mensagem"><Send className="w-3 h-3" /></Button>
        )}
      </div>
    </div>
  );
}
