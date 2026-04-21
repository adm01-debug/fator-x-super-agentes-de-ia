# 🤖 Agentes a Implementar — Fator X / Promo Brindes

> Catálogo executivo de **todos os agentes de IA** que serão implementados no Nexus Agents Studio para operar a Promo Brindes end-to-end.
>
> **Data:** 2026-04-21 · **Versão:** 1.0 · **Status:** Roadmap aprovado

---

## 📊 Sumário Executivo

| Métrica | Valor |
|---|---|
| **Total de agentes planejados** | **32 agentes** |
| **Agentes já existentes (parciais)** | 3 (Nexus, Oráculo, Cérebro) |
| **Agentes novos a construir** | 29 |
| **Squads (times de agentes)** | 8 squads |
| **Cobertura organizacional** | Comercial, Operações, Financeiro, RH, TI, Marketing, Diretoria |
| **Padrão de orquestração** | Hierárquico (Nexus = supervisor) + Swarm (squads especialistas) |

---

## 🏛️ Arquitetura Geral

```
                    ┌─────────────────────┐
                    │   NEXUS (Supervisor) │
                    │   Orquestrador-mãe   │
                    └──────────┬──────────┘
                               │
       ┌───────────────────────┼───────────────────────┐
       │                       │                       │
   ┌───▼────┐              ┌───▼────┐              ┌───▼────┐
   │ ORÁCULO│              │ CÉREBRO│              │ FATOR X│
   │ Council│              │ Memory │              │ Studio │
   └────────┘              └────────┘              └────────┘
       │                       │                       │
       └─────────┬─────────────┴─────────┬────────────┘
                 │                       │
        ┌────────▼────────┐    ┌────────▼────────┐
        │  8 SQUADS de    │    │  Tools/MCP/API  │
        │  agentes spec.  │    │  (Bitrix, n8n)  │
        └─────────────────┘    └─────────────────┘
```

---

## 🎯 Squad 1 — Núcleo Cognitivo (3 agentes)

Agentes-mãe que orquestram todos os outros. Já existem parcialmente.

### 1.1 🧠 Nexus — Supervisor Geral
- **Status:** ✅ Existe (precisa promover de chat para orquestrador)
- **Modelo:** Claude Sonnet 4.6 (fallback Opus 4.6)
- **Persona:** Coordenador estratégico
- **Missão:** Receber qualquer requisição da empresa, classificar intenção, rotear para o squad correto, consolidar respostas e escalar para humanos quando necessário
- **Memória:** Compartilhada (lê todos squads), perfil por usuário
- **Tools:** Roteamento A2A, todos MCPs, web search, agentes_list
- **Canais:** WhatsApp, Web Chat, Slack, Bitrix24

### 1.2 🔮 Oráculo — Conselho Multi-LLM
- **Status:** ⚠️ Parcial (edge function `oracle-council` existe, sem UI)
- **Modelos:** Claude Opus + GPT-5 + Gemini 2.5 Pro (consenso)
- **Persona:** Analista sênior multi-perspectiva
- **Missão:** Decisões estratégicas de alto risco — consulta 3 LLMs em paralelo, compara respostas, gera relatório de consenso/divergência
- **Quando acionar:** Decisões > R$ 10k, contratos, contratações, mudanças estratégicas
- **Output:** Relatório markdown + recomendação final + dissensos

### 1.3 💭 Cérebro — Memória Corporativa
- **Status:** ⚠️ Parcial (SuperCerebroPage existe, faltam tiers)
- **Modelo:** Embeddings + LLM resumidor
- **Persona:** Bibliotecário organizacional
- **Missão:** Indexar TUDO que acontece na empresa (emails, reuniões, docs, decisões), gerar resumos diários/semanais, responder "o que foi decidido sobre X?"
- **Tiers de memória:** Hot (7d), Warm (90d), Cold (∞)
- **Decay:** Knowledge decay automático para info estale

---

## 💼 Squad 2 — Comercial (5 agentes)

### 2.1 🎯 Vendas — Closer
- **Modelo:** Claude Sonnet 4.6
- **Missão:** Atender leads via WhatsApp/site, qualificar (BANT), fazer cotações de brindes, fechar pedidos < R$ 5k autonomamente
- **Tools:** Catálogo Promo Brindes, calculadora de preços, gerador de PDF de proposta, Bitrix24 (criar deal)
- **Escalação:** > R$ 5k → Pink; condições especiais → Cérebro humano
- **KPIs:** Taxa de conversão lead→deal, tempo médio resposta < 2min

### 2.2 🔍 Prospector — Outbound
- **Modelo:** Sonnet + browser
- **Missão:** Pesquisar empresas-alvo (LinkedIn, Google Maps, Receita Federal), enriquecer dados, gerar listas qualificadas, redigir cold emails personalizados
- **Tools:** Browser MCP, web_search, CNPJ lookup, LinkedIn scraper
- **Output:** Lista CSV + sequência de emails pronta no n8n

### 2.3 📋 Cotador — Especialista de Produto
- **Modelo:** Haiku 4.5 (rápido, barato)
- **Missão:** Calcular preços precisos baseado em quantidade, material, gravação, prazo, frete; comparar fornecedores
- **Tools:** Catálogo, tabela de fornecedores, calculadora de margens
- **Diferencial:** Suporta upload de imagem do produto (multimodal)

### 2.4 🎨 Designer de Mockup
- **Status:** ⚠️ Edge function `product-mockup` existe sem UI
- **Modelo:** Gemini 3 Flash Image + Nano Banana
- **Missão:** Receber logo do cliente + produto escolhido, gerar mockup fotorrealista do brinde personalizado em 30s
- **Output:** PNG/JPG alta resolução + variações de cor/posição

### 2.5 📞 Pós-Venda — Customer Success
- **Modelo:** Sonnet
- **Missão:** Acompanhar pedidos pós-fechamento, enviar updates de produção, NPS automático, identificar oportunidades de upsell/recompra
- **Triggers:** Mudança de status no Bitrix24 (deal stage)

---

## 🏭 Squad 3 — Operações & Produção (4 agentes)

### 3.1 📦 Gestor de Pedidos
- **Missão:** Acompanhar cada pedido do fechamento à entrega, atualizar status, alertar atrasos, comunicar cliente proativamente
- **Tools:** Bitrix24, n8n, integração transportadoras

### 3.2 🏗️ Comprador — Sourcing
- **Missão:** Cotar com 3+ fornecedores, comparar prazo/preço/qualidade, recomendar escolha, gerar PO
- **Tools:** Email automation, planilha de fornecedores, scoring histórico

### 3.3 🚚 Logística
- **Missão:** Calcular frete (Correios, transportadoras), agendar coletas, rastrear entregas, resolver extravios
- **Tools:** APIs Correios, Loggi, Jadlog

### 3.4 ⚠️ Quality Assurance
- **Missão:** Receber fotos do produto pronto antes do envio, validar qualidade da gravação/cor/quantidade via vision LLM, aprovar ou rejeitar
- **Modelo:** Gemini 2.5 Pro (vision)

---

## 💰 Squad 4 — Financeiro (3 agentes)

### 4.1 📊 Contas a Pagar/Receber
- **Missão:** Reconciliar pagamentos, emitir cobranças, gerar boletos, alertar inadimplência
- **Tools:** Integração banco (Open Finance), Bitrix24

### 4.2 🧾 Fiscal
- **Missão:** Emitir NF-e, calcular impostos, gerar guias DAS/DARF, alertar vencimentos
- **Compliance:** SEFAZ, Receita Federal

### 4.3 📈 Controller
- **Missão:** Gerar DRE mensal automático, análise de margem por cliente/produto, forecast de caixa, alertas de desvios
- **Output:** Dashboard + relatório PDF semanal para Pink

---

## 👥 Squad 5 — Pessoas & RH (3 agentes)

### 5.1 🎓 Recrutador
- **Missão:** Triar currículos, agendar entrevistas, gerar perguntas customizadas por vaga, comparar candidatos
- **Tools:** Email, calendário, LinkedIn

### 5.2 📚 Onboarding
- **Missão:** Guiar novo funcionário nos primeiros 30 dias, responder dúvidas sobre processos, validar checklist de integração

### 5.3 ❤️ People Analytics
- **Missão:** Pesquisas de clima, análise de sentimento em comunicações internas, alertas de risco de turnover

---

## 🛠️ Squad 6 — TI & Automação (4 agentes)

### 6.1 🤖 N8N Architect
- **Missão:** Criar workflows n8n a partir de descrição em linguagem natural ("quando X acontecer, faça Y")
- **Tools:** MCP n8n (já existe), web_search

### 6.2 🔌 Integrador
- **Missão:** Conectar novos sistemas (APIs, webhooks), gerar código de integração, testar endpoints
- **Tools:** Browser, exec, code execution

### 6.3 🛡️ SecOps
- **Missão:** Monitorar logs de segurança, detectar acessos suspeitos, validar compliance LGPD, gerar relatórios de auditoria
- **Tools:** Audit log, security scans

### 6.4 📡 Observability
- **Missão:** Monitorar saúde de todos agentes, custos por agente, latência, taxa de erro; sugerir otimizações
- **Output:** Dashboard NexusTracer

---

## 📣 Squad 7 — Marketing & Conteúdo (4 agentes)

### 7.1 ✍️ Copywriter
- **Missão:** Redigir posts de blog, emails marketing, descrições de produto, anúncios — sempre tom Promo Brindes
- **Modelo:** Claude Sonnet (criativo)

### 7.2 📱 Social Media Manager
- **Missão:** Planejar calendário editorial, agendar posts (Instagram, LinkedIn), responder DMs com brand voice
- **Tools:** Buffer/Later API, browser

### 7.3 🎬 Video & Image Creator
- **Missão:** Gerar vídeos de produto curtos, posts visuais, banners de campanha
- **Modelos:** Veo 3, Gemini 3 Image, Sora

### 7.4 📈 Growth Analyst
- **Missão:** Analisar Google Ads, Meta Ads, GA4 — identificar campanhas vencedoras, sugerir realocação de budget
- **Tools:** Google Ads API, Meta API, GA4 MCP

---

## 🎩 Squad 8 — Executivo & Estratégia (3 agentes)

### 8.1 📋 Chief of Staff (Pink)
- **Missão:** Assistente pessoal do diretor — agenda, briefings de reuniões, resumos diários, follow-ups
- **Tools:** Calendário, email, todos squads via Nexus
- **Tom:** Formal, ultra-conciso

### 8.2 ♟️ Strategist
- **Missão:** Análise SWOT contínua, monitoramento de concorrentes, recomendações estratégicas trimestrais
- **Modelo:** Opus 4.6 + Oráculo Council
- **Output:** Memo estratégico mensal

### 8.3 📊 BI Analyst
- **Missão:** Responder qualquer pergunta de negócio em linguagem natural ("qual cliente mais comprou em Q1?"), gerar gráficos
- **Tools:** DataHub query, SQL generation, charting

---

## 🎲 Squad 9 — Suporte Transversal (3 agentes utilitários)

### 9.1 🌐 Tradutor
- Multi-idioma (PT/EN/ES) para emails internacionais

### 9.2 📝 Transcrição & Atas
- **Status:** ⚠️ Edge function `audio-transcribe` existe sem UI ativa
- Transcreve reuniões + gera ata estruturada com decisões/action items

### 9.3 🔊 Voz Corporativa (TTS)
- **Status:** ⚠️ Edge function `text-to-speech` existe sem UI
- Gera áudios para WhatsApp/atendimento humanizado

---

## 📅 Roadmap de Implementação

| Sprint | Duração | Agentes entregues | Squads |
|---|---|---|---|
| **Sprint 1** | 2 sem | Nexus completo + Oráculo UI + Cérebro tiers | Núcleo Cognitivo (3) |
| **Sprint 2** | 3 sem | Vendas, Cotador, Mockup, Pós-Venda, Prospector | Comercial (5) |
| **Sprint 3** | 2 sem | Gestor Pedidos, Comprador, Logística, QA | Operações (4) |
| **Sprint 4** | 2 sem | AP/AR, Fiscal, Controller | Financeiro (3) |
| **Sprint 5** | 2 sem | N8N Architect, Integrador, SecOps, Observability | TI (4) |
| **Sprint 6** | 2 sem | Copywriter, Social, Video, Growth | Marketing (4) |
| **Sprint 7** | 2 sem | Chief of Staff, Strategist, BI Analyst | Executivo (3) |
| **Sprint 8** | 1 sem | Recrutador, Onboarding, People Analytics | RH (3) |
| **Sprint 9** | 1 sem | Tradutor, Transcrição, TTS | Utilitários (3) |
| **TOTAL** | **17 sem (~4 meses)** | **32 agentes** | **8 squads** |

---

## 🔧 Padrão Técnico de Cada Agente

Todo agente novo seguirá esta estrutura no Nexus Agents Studio:

```yaml
identidade:
  name: <nome>
  mission: <1 frase>
  persona: assistant|specialist|coordinator|analyst|creative|autonomous
  avatar_emoji: <emoji>
  tags: [squad, função]

modelo:
  primary: claude-sonnet-4.6  # default
  fallback: gpt-5-mini
  temperature: 0.3-0.7
  max_tokens: 4096

memória:
  short_term: ✅ (sliding window 20 msgs)
  episodic: ✅ (vector_db)
  semantic: ✅ (knowledge graph)
  shared: ✅ (lê squad)

rag:
  architecture: agentic
  vector_db: pgvector
  sources: [docs específicos do squad]

tools: [MCPs + APIs específicas]

guardrails:
  - input_validation
  - pii_redaction
  - cost_limit_per_session
  - blocked_topics

deploy_channels: [api, whatsapp, web_chat, bitrix24]

monitoring:
  budget_monthly: R$ 50-500 (varia)
  alerts: latency_p95, error_rate, cost_overrun
```

---

## 🎯 Critérios de Sucesso por Agente

Cada agente só vai a produção quando atingir:
- ✅ **Score de prontidão ≥ 85/100** (ReadinessScore)
- ✅ **Test cases ≥ 20** com 95%+ pass rate
- ✅ **Eval metrics:** accuracy ≥ 0.85, hallucination rate < 5%
- ✅ **Guardrails:** mínimo 5 ativos
- ✅ **Aprovação humana:** Pink + Cérebro
- ✅ **Documentação:** SOUL.md + AGENTS.md no padrão OpenClaw

---

## 💡 Próximos Passos Imediatos

1. **Validar este catálogo** com Pink e Cérebro
2. **Priorizar Sprint 1** (Nexus + Oráculo + Cérebro completos)
3. **Criar templates** no `agent_templates` (Supabase) para cada arquétipo
4. **Configurar squads** como workspaces separados ou tags
5. **Iniciar build** do agente Vendas (maior ROI imediato)

---

**Documento vivo** — atualize conforme novos agentes forem propostos ou priorizados.

> 🚀 **Visão:** Em 4 meses, a Promo Brindes opera com **32 agentes especializados** trabalhando 24/7, coordenados pelo Nexus, com Pink e Cérebro focados apenas em decisões estratégicas de alto valor.
