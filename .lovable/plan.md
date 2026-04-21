

## Teste rápido do agente antes de criar

Adiciono um botão **"Testar agente"** no passo 4 (Prompt) do wizard rápido que executa uma chamada real ao LLM com um payload de exemplo e mostra resposta, custo estimado e latência — tudo antes de salvar.

### UX no passo Prompt

```text
[ Variações de prompt ]
[ Editor de prompt ]
[ Checklist 4/4 ✓ ]
[ Pré-visualização do agente ]
[ Prompt consolidado ]

┌─ Teste rápido ───────────────────────────────────────┐
│ Mensagem de teste (mock):                            │
│ ┌──────────────────────────────────────────────────┐ │
│ │ Olá! Você pode se apresentar?                    │ │  ← textarea editável
│ └──────────────────────────────────────────────────┘ │
│                                                       │
│ [Mock por tipo ▾]   [▶ Executar teste]               │
└──────────────────────────────────────────────────────┘

┌─ Resultado ──────────────────────────────────────────┐
│  ⚡ 1.247ms     💰 ~R$ 0,012 (US$ 0,0021)            │
│  📊 142 in / 386 out tokens  ·  modelo: gpt-4o       │
│                                                       │
│  Resposta:                                            │
│  ┌────────────────────────────────────────────────┐  │
│  │ Olá! Eu sou Aurora, sua assistente...          │  │
│  └────────────────────────────────────────────────┘  │
│                                                       │
│  [Copiar resposta] [Executar novamente]              │
└──────────────────────────────────────────────────────┘
```

### Mocks por tipo de agente

Cada `QuickAgentType` recebe um mock de input default que faz sentido pra ele:

| Tipo          | Mensagem mock                                                       |
| ------------- | ------------------------------------------------------------------- |
| chatbot       | "Olá! Como você pode me ajudar hoje?"                               |
| copilot       | "Resuma essa thread em 3 bullets: [exemplo de thread curta]"        |
| analyst       | "Vendas: Jan R$120k (+8%), Fev R$98k (-18%), Mar R$145k (+47%). O que aconteceu?" |
| sdr           | "Oi! Vi vocês no LinkedIn, somos uma logtech com 80 funcionários e queremos automação." |
| support       | "Não consigo logar há 2 dias. Já troquei a senha 3x."               |
| researcher    | "Quais os principais frameworks de orquestração de agentes em 2025?" |
| orchestrator  | "Preciso de uma análise de churn dos últimos 90 dias com recomendações." |

Dropdown deixa o usuário trocar entre os 7 mocks ou editar livremente o textarea.

### Mudanças

**`supabase/functions/quick-agent-test/index.ts`** (novo edge function):
- POST `{ system_prompt, user_message, model }`
- Chama Lovable AI Gateway (`https://ai.gateway.lovable.dev/v1/chat/completions`) com `LOVABLE_API_KEY`.
- Mapeia o `model` do form (`gpt-4o`, `claude-3.5-sonnet`, etc.) para um modelo suportado pelo gateway:
  - `gpt-4o`, `gpt-4-turbo` → `openai/gpt-5-mini`
  - `claude-3.5-sonnet`, `claude-3-opus` → `google/gemini-2.5-pro`
  - `gemini-1.5-pro` → `google/gemini-2.5-flash`
  - `llama-3-70b` → `google/gemini-2.5-flash-lite`
- Mede latência server-side (`Date.now()` antes/depois do fetch).
- Retorna: `{ response, latency_ms, input_tokens, output_tokens, model_used }`.
- Trata 429 (rate limit) e 402 (sem créditos) com mensagens claras.
- CORS, validação Zod, sem JWT obrigatório (`verify_jwt = false`).

**`src/data/quickAgentTemplates.ts`**:
- Adicionar `QUICK_AGENT_MOCK_INPUTS: Record<QuickAgentType, { label: string; input: string }[]>` com 1-2 mocks por tipo (default + alternativo).

**`src/components/agents/wizard/quickSteps/QuickAgentTestPanel.tsx`** (novo):
- Estado: `userInput`, `loading`, `result`, `error`.
- Textarea controlada com o mock default do tipo.
- Dropdown `Select` com mocks pré-prontos do tipo atual + opção "Limpar".
- Botão **▶ Executar teste**: chama `supabase.functions.invoke('quick-agent-test', { body: { system_prompt: form.prompt, user_message: userInput, model: form.model } })`.
- Calcula custo via `useCostEstimate({ model: form.model, systemPrompt: form.prompt, userInput, maxTokens: 1000 })` para a estimativa **pré-execução** (mostrada antes de rodar).
- Após resposta, atualiza com **custo real** usando os tokens retornados pelo gateway × `getModelPrice(form.model)`.
- Cards de métrica: ⚡ latência, 💰 custo (BRL+USD), 📊 tokens (in/out).
- Bloco de resposta com `<pre>` ou markdown simples (mesmo renderer do `CompiledPromptPreview`).
- Botões: "Copiar resposta", "Executar novamente".
- Validação local: bloqueia execução se `prompt` for inválido (usa `quickPromptSchema.safeParse`) ou `userInput` vazio — mostra hint inline.
- Toast Sonner em erro / sucesso com `latency_ms`.

**`src/components/agents/wizard/quickSteps/StepQuickPrompt.tsx`**:
- Renderizar `<QuickAgentTestPanel form={form} />` no final do step (depois do CompiledPromptPreview).

### Detalhes técnicos

- **Sem mudanças no banco** — teste é stateless, não persiste nada.
- **Sem mudanças no payload de save** — o teste é totalmente isolado do `saveAgent`.
- **Custo**: usa `useCostEstimate` (já existente em `src/hooks/useCostEstimate.ts`) para a estimativa pré-call e recalcula com tokens reais via `getModelPrice` de `@/lib/llmPricing`.
- **Tratamento de erros**: 429 → "Limite de requisições atingido, aguarde um instante"; 402 → "Adicione créditos em Configurações > Workspace > Uso"; 500+ → mensagem do gateway.
- **Acessibilidade**: textarea com `aria-label`, botão com `aria-busy={loading}`, `role="status"` no resultado, foco volta pro botão depois.
- **Tokens semânticos**: `--primary` (botão), `--nexus-emerald` (sucesso), `--nexus-rose` (erro), `--secondary` (fundos), sem cores hard-coded.

### Impacto

- Zero migração, zero alteração de schema, zero rotas novas.
- Usuário ganha confiança antes de salvar — vê resposta real, latência real e custo estimado.
- Reusa infraestrutura existente: `useCostEstimate`, `llmPricing`, padrão de edge function do projeto.
- Edge function `quick-agent-test` fica disponível pra reuso futuro (playground, modo Avançado).

