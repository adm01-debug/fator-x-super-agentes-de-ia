
#2 done. Próxima: **#8 Conversational Builder** — chat-to-agent via Lovable AI.

## #8 Conversational Builder — Escopo

Wizard conversacional que faz perguntas e auto-preenche o agente via Lovable AI (Gemini Flash, sem custo).

**Edge function:**
- `supabase/functions/agent-conversational-builder/index.ts`
- Input: `{ messages: ChatMessage[], currentAgent: Partial<AgentConfig> }`
- Usa `LOVABLE_API_KEY` + `google/gemini-2.5-flash`
- System prompt: "Você é um assistente que ajuda a configurar agentes IA. Faça 1 pergunta por vez sobre missão, persona, modelo, ferramentas, guardrails. Quando tiver info suficiente, retorne JSON com `patch: Partial<AgentConfig>` + `next_question` ou `done: true`."
- Streaming via SSE (mesmo padrão de outras edge functions)

**Componente:**
- `src/components/agent-builder/ConversationalBuilder.tsx` — Sheet lateral
- Chat UI: bolhas user/assistant, input, send
- Ao receber `patch` → `updateAgent(patch)` + toast "Campo X preenchido"
- Botão "Aplicar e fechar" no fim

**Trigger:**
- Botão "✨ Builder Conversacional" no header do `AgentBuilderLayout` (ao lado de History)
- Ou no IdentityModule como CTA grande para agentes vazios

**Arquivos:**
- criar `supabase/functions/agent-conversational-builder/index.ts`
- criar `src/components/agent-builder/ConversationalBuilder.tsx`
- editar `src/components/agent-builder/AgentBuilderLayout.tsx` — botão + Sheet
- editar `supabase/config.toml` — registrar função (`verify_jwt = false` para teste, depois true)

**Validação:** clicar botão → chat abre → "quero um agente de suporte" → IA pergunta detalhes → campos preenchem em tempo real no builder atrás.

Próximas sem pausar: #5 → #6 → #9 → #10 → #7.
