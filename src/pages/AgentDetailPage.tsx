import { useParams, useNavigate } from "react-router-dom";
import { agents } from "@/lib/mock-data";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { MetricCard } from "@/components/shared/MetricCard";
import { Input } from "@/components/ui/input";
import { InfoHint } from "@/components/shared/InfoHint";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bot, Zap, Clock, DollarSign, CheckCircle, Star, ArrowLeft, Hash, Wrench, Send, MessageSquare } from "lucide-react";
import { useState } from "react";

const chatHistory = [
  { role: 'user', content: 'Como integro a API de pagamentos com o módulo de assinaturas?' },
  { role: 'assistant', content: 'Para integrar a API de pagamentos com o módulo de assinaturas, siga estes passos:\n\n1. **Configure as credenciais** no painel de integrações\n2. **Crie um webhook** para receber notificações de pagamento\n3. **Mapeie os planos** de assinatura com os produtos cadastrados\n4. **Implemente o fluxo** de checkout usando nosso SDK\n\nPosso detalhar algum desses passos?' },
  { role: 'user', content: 'Detalhe o passo 2 sobre webhooks' },
  { role: 'assistant', content: 'Para configurar webhooks de pagamento:\n\n```\nPOST /api/webhooks\n{\n  "url": "https://seu-dominio.com/webhooks/pagamento",\n  "events": ["payment.created", "payment.confirmed", "subscription.renewed"]\n}\n```\n\nO endpoint retornará um `webhook_secret` que deve ser usado para validar as requisições recebidas. Recomendo armazenar em variável de ambiente.' },
];

export default function AgentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const agent = agents.find(a => a.id === id) || agents[0];
  const [chatInput, setChatInput] = useState('');

  const metrics = [
    { title: "Sessões 24h", value: agent.sessions24h.toLocaleString(), icon: Zap },
    { title: "Latência média", value: `${agent.avgLatency}s`, icon: Clock },
    { title: "Custo hoje", value: `R$ ${agent.costToday.toFixed(2)}`, icon: DollarSign },
    { title: "Taxa de sucesso", value: `${agent.successRate}%`, icon: CheckCircle },
    { title: "Satisfação", value: agent.satisfaction > 0 ? `${agent.satisfaction}/5` : '—', icon: Star },
    { title: "Tool calls", value: agent.toolCalls.toLocaleString(), icon: Wrench },
  ];

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <Button variant="ghost" size="sm" onClick={() => navigate('/agents')} className="gap-2 text-muted-foreground -ml-2 mb-2">
        <ArrowLeft className="h-3.5 w-3.5" /> Voltar para agentes
      </Button>

      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Bot className="h-7 w-7 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-heading font-bold text-foreground">{agent.name}</h1>
              <StatusBadge status={agent.status} size="md" />
              <StatusBadge status={agent.maturity} size="md" />
            </div>
            <p className="text-sm text-muted-foreground mt-1">{agent.description}</p>
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
              <span>{agent.model}</span>
              <span>•</span>
              <span>{agent.type}</span>
              <span>•</span>
              <span>Owner: {agent.owner}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">Editar</Button>
          <Button size="sm" className="nexus-gradient-bg text-primary-foreground hover:opacity-90">Deploy</Button>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {metrics.map((m, i) => <MetricCard key={i} {...m} />)}
      </div>

      {/* Tabs + Playground */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="bg-secondary/50 border border-border/50">
              {['Overview', 'Prompt', 'Tools', 'Memory', 'Knowledge', 'Evaluations', 'Logs', 'Versions'].map(tab => (
                <TabsTrigger key={tab} value={tab.toLowerCase()} className="text-xs data-[state=active]:bg-background">{tab}</TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="overview" className="mt-4 space-y-4">
              <div className="nexus-card">
                <h3 className="text-sm font-heading font-semibold text-foreground mb-3">Readiness Score</h3>
                <div className="flex items-center gap-4">
                  <div className="relative h-20 w-20">
                    <svg viewBox="0 0 36 36" className="h-20 w-20 -rotate-90">
                      <circle cx="18" cy="18" r="15.5" fill="none" stroke="hsl(var(--secondary))" strokeWidth="3" />
                      <circle cx="18" cy="18" r="15.5" fill="none" stroke="hsl(var(--primary))" strokeWidth="3"
                        strokeDasharray={`${agent.successRate * 0.975} 97.5`} strokeLinecap="round" />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-sm font-heading font-bold text-foreground">
                      {agent.successRate > 0 ? Math.round(agent.successRate) : 0}%
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {[
                      { label: 'Prompt configurado', ok: true },
                      { label: 'Knowledge base vinculada', ok: agent.tags.includes('RAG') },
                      { label: 'Avaliação executada', ok: agent.maturity !== 'prototype' },
                      { label: 'Guardrails ativos', ok: agent.maturity === 'production' },
                      { label: 'Deploy em produção', ok: agent.maturity === 'production' },
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className={`h-1.5 w-1.5 rounded-full ${item.ok ? 'bg-nexus-emerald' : 'bg-nexus-surface-3'}`} />
                        <span className={item.ok ? 'text-foreground' : 'text-muted-foreground'}>{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="nexus-card">
                <h3 className="text-sm font-heading font-semibold text-foreground mb-3">Tokens (últimas 24h)</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Input</p>
                    <p className="text-lg font-heading font-bold text-foreground">{(agent.tokensIn / 1000).toFixed(0)}k</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Output</p>
                    <p className="text-lg font-heading font-bold text-foreground">{(agent.tokensOut / 1000).toFixed(0)}k</p>
                  </div>
                </div>
              </div>

              <InfoHint title="Maturidade do agente">
                Um agente passa por três estágios: Protótipo (configuração inicial), Testado (avaliações aprovadas) e Produção (deploy com guardrails ativos). O readiness score indica o progresso.
              </InfoHint>
            </TabsContent>

            <TabsContent value="prompt" className="mt-4">
              <div className="nexus-card">
                <h3 className="text-sm font-heading font-semibold text-foreground mb-3">System Prompt — v2.4</h3>
                <div className="rounded-lg bg-nexus-surface-1 p-4 font-mono text-xs text-foreground leading-relaxed whitespace-pre-wrap">
{`Você é o Atlas, um assistente de suporte premium da empresa Nexus.

## Persona
- Tom profissional mas acolhedor
- Respostas precisas e concisas
- Sempre cite a fonte da informação

## Escopo
- Responder dúvidas técnicas sobre o produto
- Guiar integrações e configurações
- Escalar para humano quando fora do escopo

## Ferramentas disponíveis
- search_knowledge: buscar na base técnica
- crm_lookup: consultar dados do cliente
- create_ticket: abrir ticket de suporte

## Formato
- Use markdown para formatação
- Inclua links relevantes da documentação
- Máximo 300 palavras por resposta`}
                </div>
                <div className="flex gap-2 mt-3">
                  <span className="nexus-badge-success">Clareza ✓</span>
                  <span className="nexus-badge-success">Escopo ✓</span>
                  <span className="nexus-badge-success">Ferramentas ✓</span>
                  <span className="nexus-badge-success">Formato ✓</span>
                  <span className="nexus-badge-success">Segurança ✓</span>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="tools" className="mt-4">
              <div className="nexus-card space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Ferramentas Ativas</h3>
                <div className="grid grid-cols-2 gap-2">
                  {['Web Search', 'Database Query', 'CRM Update', 'Email Sender'].map(t => (
                    <div key={t} className="flex items-center gap-2 p-2 rounded-lg bg-secondary/30 text-xs text-foreground"><span className="h-2 w-2 rounded-full bg-emerald-400" />{t}</div>
                  ))}
                </div>
              </div>
            </TabsContent>
            <TabsContent value="memory" className="mt-4">
              <div className="nexus-card space-y-2">
                <h3 className="text-sm font-semibold text-foreground">Camadas de Memória</h3>
                {['Curto Prazo (ativa)', 'Episódica (ativa)', 'Semântica (inativa)', 'Perfil (ativa)'].map(m => (
                  <div key={m} className="flex items-center gap-2 text-xs text-muted-foreground"><span className={`h-2 w-2 rounded-full ${m.includes('ativa)') && !m.includes('inativa') ? 'bg-emerald-400' : 'bg-muted'}`} />{m}</div>
                ))}
              </div>
            </TabsContent>
            {['knowledge', 'evaluations', 'logs', 'versions'].map(tab => (
              <TabsContent key={tab} value={tab} className="mt-4">
                <div className="nexus-card text-center py-8">
                  <p className="text-sm text-muted-foreground">Configure no <button onClick={() => navigate('/builder')} className="text-primary hover:underline">Agent Builder</button></p>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </div>

        {/* Playground */}
        <div className="nexus-card flex flex-col h-[600px]">
          <div className="flex items-center justify-between mb-3 pb-3 border-b border-border/50">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-heading font-semibold text-foreground">Playground</h3>
            </div>
            <span className="nexus-badge-success">Online</span>
          </div>
          <div className="flex-1 overflow-y-auto space-y-3 mb-3">
            {chatHistory.map((msg, i) => (
              <div key={i}
                className={`rounded-xl p-3 text-xs leading-relaxed ${
                  msg.role === 'user' ? 'bg-primary/10 text-foreground ml-6' : 'bg-secondary/50 text-foreground mr-4'
                }`}
              >
                <p className="text-[10px] font-medium text-muted-foreground mb-1">{msg.role === 'user' ? 'Você' : agent.name.split('—')[0].trim()}</p>
                <div className="whitespace-pre-wrap">{msg.content}</div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 pt-2 border-t border-border/50">
            <Input
              placeholder="Testar agente..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              className="text-xs bg-secondary/50 border-border/50"
            />
            <Button
              size="icon"
              className="shrink-0 nexus-gradient-bg text-primary-foreground hover:opacity-90 h-9 w-9"
              onClick={() => {
                if (!chatInput.trim()) return;
                setChatHistory(prev => [
                  ...prev,
                  { role: 'user' as const, content: chatInput },
                  { role: 'assistant' as const, content: `Entendido! Como ${agent.name.split('—')[0].trim()}, vou analisar sua solicitação. Baseado no meu conhecimento e ferramentas disponíveis, posso ajudar com isso.` },
                ]);
                setChatInput('');
              }}
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
