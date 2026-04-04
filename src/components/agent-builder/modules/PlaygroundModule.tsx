import { useState, useCallback, useRef, useEffect } from 'react';
import { useAgentBuilderStore } from '@/stores/agentBuilderStore';
import { SectionTitle } from '../ui';
import { NexusBadge } from '../ui/NexusBadge';
import { Button } from '@/components/ui/button';
import { Send, ThumbsUp, ThumbsDown, Bug, RotateCcw, Sparkles, Mic } from 'lucide-react';
import * as llm from '@/services/llmService';
import * as traceService from '@/services/traceService';
import * as memoryService from '@/services/memoryService';
import * as securityService from '@/services/securityService';
import * as contextManager from '@/services/contextManager';
import * as voiceService from '@/services/voiceService';

interface PlaygroundMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  metadata?: {
    model: string;
    tokens: number;
    latency_ms: number;
    tools_used: string[];
    guardrails_passed: boolean;
  };
  feedback?: 'up' | 'down';
}

const SIMULATED_RESPONSES = [
  { content: 'Olá! Sou o {name}, seu {persona}. Como posso ajudar hoje?', tools: [], latency: 450 },
  { content: 'Baseado na minha base de conhecimento, posso informar que essa é uma excelente pergunta. Deixe-me analisar os dados disponíveis e fornecer uma resposta detalhada.', tools: ['Vector Search'], latency: 1200 },
  { content: 'Consultei o CRM e encontrei as informações relevantes. Aqui está o que descobri sobre sua solicitação, com base nos dados mais recentes disponíveis.', tools: ['CRM Update', 'Database Query'], latency: 1800 },
  { content: 'Analisei a situação considerando múltiplos fatores. Minha recomendação é seguir o processo padrão, mas com uma adaptação específica para este caso.', tools: ['Data Analyzer'], latency: 950 },
  { content: 'Entendo sua preocupação. Vou verificar isso imediatamente e tomar as ações necessárias dentro do meu escopo de atuação.', tools: [], latency: 380 },
];

export function PlaygroundModule() {
  const agent = useAgentBuilderStore((s) => s.agent);
  const [messages, setMessages] = useState<PlaygroundMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Abort any in-flight LLM call on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: PlaygroundMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    // Trim conversation to fit context window
    const trimmedMessages = contextManager.trimConversation(
      messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      8000
    );

    // Build system prompt from agent config
    const systemPrompt = agent.system_prompt || `Você é ${agent.name || 'um assistente'}, um ${agent.persona || 'assistente'} especializado. ${agent.scope ? `Escopo: ${agent.scope}.` : ''} Responda de forma ${agent.formality > 70 ? 'formal' : 'casual'} e ${agent.verbosity > 70 ? 'detalhada' : 'concisa'}.`;

    // Build conversation history
    const history: llm.LLMMessage[] = [
      { role: 'system', content: systemPrompt },
      ...messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      { role: 'user' as const, content: input.trim() },
    ];

    // ═══ SECURITY CHECK ═══
    const secCheck = securityService.checkInputSecurity(input.trim());
    if (!secCheck.allowed) {
      setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'assistant', content: `🛡️ Bloqueado: ${secCheck.blockedReason}`, timestamp: new Date().toISOString() }]);
      setIsLoading(false);
      return;
    }

    // ═══ GUARDRAILS CHECK ═══
    const guardCheck = traceService.checkInputGuardrails(input.trim());
    if (!guardCheck.allowed) {
      setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'assistant', content: `⚠️ Bloqueado por guardrail: ${guardCheck.blocked}`, timestamp: new Date().toISOString(), metadata: { model: 'guardrail', tokens: 0, latency_ms: 0, tools_used: guardCheck.triggered, guardrails_passed: false } }]);
      setIsLoading(false);
      return;
    }

    if (llm.isLLMConfigured()) {
      // ═══ REAL LLM CALL (with auto-trace) ═══
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const modelId = agent.model?.includes('/') ? agent.model : `anthropic/${agent.model || 'claude-sonnet-4'}`;
      let response: Awaited<ReturnType<typeof llm.callModel>>;
      try {
        response = await llm.callModel(modelId, history, {
          temperature: (agent.temperature ?? 70) / 100,
          maxTokens: agent.max_tokens ?? 2048,
          signal: controller.signal,
        });
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          setIsLoading(false);
          return;
        }
        throw err;
      }

      // Output guardrails check
      const outputCheck = traceService.checkOutputGuardrails(response.content);
      const guardrailsTriggered = [...guardCheck.triggered, ...outputCheck.triggered];

      const assistantMsg: PlaygroundMessage = {
        id: crypto.randomUUID(), role: 'assistant',
        content: outputCheck.allowed ? response.content : `${response.content}\n\n⚠️ Guardrail: ${outputCheck.triggered.join(', ')}`,
        timestamp: new Date().toISOString(),
        metadata: {
          model: response.model,
          tokens: response.tokens.input + response.tokens.output,
          latency_ms: response.latencyMs,
          tools_used: response.error ? ['error'] : guardrailsTriggered.length > 0 ? guardrailsTriggered : [],
          guardrails_passed: guardrailsTriggered.length === 0,
        },
      };
      setMessages(prev => [...prev, assistantMsg]);
      // Auto-extract memory from conversation
      memoryService.autoExtractFromConversation(agent.id ?? 'default', input.trim(), response.content);
    } else {
      // ═══ FALLBACK SIMULATION ═══
      const sim = SIMULATED_RESPONSES[Math.floor(Math.random() * SIMULATED_RESPONSES.length)];
      await new Promise(r => setTimeout(r, sim.latency + Math.random() * 500));

      const assistantMsg: PlaygroundMessage = {
        id: crypto.randomUUID(), role: 'assistant',
        content: sim.content.replace('{name}', agent.name || 'Agente').replace('{persona}', agent.persona || 'assistente'),
        timestamp: new Date().toISOString(),
        metadata: { model: agent.model + ' (simulado)', tokens: Math.floor(50 + Math.random() * 200), latency_ms: Math.round(sim.latency), tools_used: sim.tools, guardrails_passed: true },
      };
      setMessages(prev => [...prev, assistantMsg]);
    }
    setIsLoading(false);
  }, [input, isLoading, agent.name, agent.persona, agent.model]);

  const toggleFeedback = (msgId: string, type: 'up' | 'down') => {
    setMessages(prev => prev.map(m =>
      m.id === msgId ? { ...m, feedback: m.feedback === type ? undefined : type } : m
    ));
  };

  const clearChat = () => {
    setMessages([]);
  };

  return (
    <div className="space-y-6">
      <SectionTitle
        icon="🎮"
        title="Playground"
        subtitle="Teste seu agente ao vivo com a configuração atual"
        badge={<NexusBadge color="green">Simulação</NexusBadge>}
      />

      {/* Controls */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => setDebugMode(!debugMode)} className={`gap-2 ${debugMode ? 'border-primary text-primary' : ''}`}>
          <Bug className="h-3.5 w-3.5" /> {debugMode ? 'Debug ON' : 'Debug OFF'}
        </Button>
        <Button variant="outline" size="sm" onClick={clearChat} className="gap-2">
          <RotateCcw className="h-3.5 w-3.5" /> Limpar
        </Button>
        <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5" />
          <span>Modelo: {agent.model} | Prompt v{agent.system_prompt_version}</span>
        </div>
      </div>

      {/* Chat Area */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="h-[400px] overflow-y-auto p-4 space-y-4" role="log" aria-label="Conversa do playground">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <span className="text-4xl mb-3">{agent.avatar_emoji || '🤖'}</span>
              <p className="text-sm font-medium text-foreground">{agent.name || 'Agente sem nome'}</p>
              <p className="text-xs text-muted-foreground mt-1">Envie uma mensagem para testar o agente</p>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-xl px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted/40 border border-border text-foreground'
              }`}>
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>

                {/* Metadata (debug mode) */}
                {msg.role === 'assistant' && debugMode && msg.metadata && (
                  <div className="mt-2 pt-2 border-t border-border/50 space-y-1 text-[10px] text-muted-foreground font-mono">
                    <div className="flex flex-wrap gap-2">
                      <span>🧠 {msg.metadata.model}</span>
                      <span>📊 {msg.metadata.tokens} tokens</span>
                      <span>⏱️ {msg.metadata.latency_ms}ms</span>
                      <span>🛡️ {msg.metadata.guardrails_passed ? 'OK' : '⚠️'}</span>
                    </div>
                    {msg.metadata.tools_used.length > 0 && (
                      <div>🔧 Tools: {msg.metadata.tools_used.join(', ')}</div>
                    )}
                  </div>
                )}

                {/* Feedback buttons */}
                {msg.role === 'assistant' && (
                  <div className="flex items-center gap-1 mt-2">
                    <button
                      onClick={() => toggleFeedback(msg.id, 'up')}
                      className={`p-1 rounded transition-colors ${msg.feedback === 'up' ? 'text-emerald-400' : 'text-muted-foreground hover:text-foreground'}`}
                      aria-label="Boa resposta"
                    >
                      <ThumbsUp className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => toggleFeedback(msg.id, 'down')}
                      className={`p-1 rounded transition-colors ${msg.feedback === 'down' ? 'text-rose-400' : 'text-muted-foreground hover:text-foreground'}`}
                      aria-label="Resposta ruim"
                    >
                      <ThumbsDown className="h-3 w-3" />
                    </button>
                    <span className="text-[10px] text-muted-foreground ml-1">
                      {new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-muted/40 border border-border rounded-xl px-4 py-3">
                <div className="flex gap-1">
                  <div className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-border p-3 flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            placeholder="Digite uma mensagem para testar o agente..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            disabled={isLoading}
          />
          <Button size="sm" onClick={sendMessage} disabled={isLoading || !input.trim()} className="gap-1.5">
            <Send className="h-3.5 w-3.5" /> Enviar
          </Button>
          <Button size="sm" variant="outline" disabled={isLoading} className="gap-1.5" onClick={async () => {
            try {
              const result = await voiceService.startListening();
              setInput(result.text);
            } catch {
              // Voice not supported or user denied permission
            }
          }}>
            <Mic className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Stats */}
      {messages.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Mensagens', value: messages.length },
            { label: 'Feedback 👍', value: messages.filter(m => m.feedback === 'up').length },
            { label: 'Feedback 👎', value: messages.filter(m => m.feedback === 'down').length },
            { label: 'Tokens total', value: messages.filter(m => m.metadata).reduce((s, m) => s + (m.metadata?.tokens ?? 0), 0) },
          ].map(s => (
            <div key={s.label} className="rounded-xl border border-border bg-card p-3 text-center">
              <p className="text-lg font-bold font-mono text-foreground">{s.value}</p>
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
