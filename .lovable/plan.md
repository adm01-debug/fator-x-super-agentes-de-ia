

## Wizard Rápido de Criação de Agente (4 passos)

Vou criar um **wizard enxuto e focado** com 4 etapas (identidade → tipo → modelo → prompt), validações inline por campo via Zod + react-hook-form, e templates mockados que pré-preenchem todos os campos automaticamente.

O wizard avançado atual (8 passos com templates, ferramentas, memória, knowledge, deploy) **continua existindo** — adiciono o novo como uma terceira opção na tela de escolha inicial.

### Fluxo do usuário

```text
/agents/new (tela de escolha)
   ├─ Usar template     → wizard atual (3 passos)
   ├─ Criar do zero     → wizard atual (8 passos)
   └─ Criação rápida ⚡ → NOVO wizard (4 passos)  ← foco desta entrega

NOVO Wizard:
  Passo 1 — Identidade   nome*, emoji, missão*, descrição
  Passo 2 — Tipo         7 tipos (chatbot, copilot, analyst, sdr, support, researcher, orchestrator)
                         + botão "Aplicar template" que pré-preenche tudo
  Passo 3 — Modelo       6 modelos com custo/velocidade/qualidade visíveis
  Passo 4 — Prompt       editor com counter de caracteres, template visual,
                         botão "Restaurar template do tipo"
  → Salvar → /agents
```

### Templates mockados (pré-preenchidos por tipo)

Cada um dos 7 tipos tem um **template completo** em `quickAgentTemplates.ts` com nome sugerido, emoji, missão, modelo recomendado e system prompt rico (8-15 linhas com Persona / Escopo / Formato / Regras). Exemplos:

- **Chatbot** → "Aurora" 💬 / GPT-4o / prompt focado em atendimento conversacional
- **SDR** → "Pink Sales" 💼 / GPT-5 / prompt de qualificação BANT no Bitrix24
- **Analyst** → "Atlas" 📊 / Claude Sonnet 4.6 / prompt de análise de dados
- **Support** → "Scout" 🎧 / Gemini 2.5 Flash / prompt L1 com triagem
- **Researcher** → "Sherlock" 🔎 / Claude Opus 4.6 / prompt de pesquisa documental
- **Copilot** → "Nova" ✨ / GPT-4o / prompt de assistente interno
- **Orchestrator** → "Maestro" 🎼 / Claude Opus 4.6 / prompt de roteamento entre sub-agentes

Ao escolher o tipo, o usuário pode clicar em **"Aplicar template"** para auto-preencher nome, emoji, missão, modelo e prompt — ou continuar editando manualmente.

### Validações (Zod + react-hook-form, inline em tempo real)

| Campo    | Regra                                                | Mensagem PT-BR                          |
|----------|------------------------------------------------------|-----------------------------------------|
| nome     | obrigatório, 2-60 chars, sem caracteres especiais    | "Use 2 a 60 letras, números ou espaços" |
| emoji    | obrigatório, 1-4 chars                               | "Escolha um emoji"                       |
| missão   | obrigatório, 10-500 chars                            | "Mínimo 10 caracteres"                   |
| tipo     | obrigatório (1 dos 7)                                | "Selecione um tipo"                      |
| modelo   | obrigatório (1 dos 6)                                | "Selecione um modelo"                    |
| prompt   | obrigatório, 50-8000 chars                           | "Mínimo 50 caracteres" + counter visual  |

- Botão "Próximo" desabilitado até campos do passo serem válidos
- Erros mostrados embaixo do campo (estilo `FormMessage` do shadcn)
- Toast de erro consolidado se tentar pular passo

### Recursos extras

- **Stepper clicável** no topo (volta para passos já visitados)
- **Atalhos**: `Enter` → próximo, `Esc` → voltar, `Ctrl+Enter` no último → criar
- **Preview ao vivo** do agente no rodapé do passo de prompt (card com emoji, nome, primeiras linhas do prompt)
- **Auto-save em localStorage** (rascunho recuperado se o usuário sair e voltar)
- **Animação de entrada** entre passos (já segue padrão `animate-page-enter`)

### Arquivos a criar/alterar

**Novos:**
- `src/data/quickAgentTemplates.ts` — 7 templates mockados ricos por tipo
- `src/lib/validations/quickAgentSchema.ts` — schemas Zod por passo + schema completo
- `src/components/agents/wizard/QuickCreateWizard.tsx` — componente principal (~250 linhas)
- `src/components/agents/wizard/quickSteps/StepQuickIdentity.tsx`
- `src/components/agents/wizard/quickSteps/StepQuickType.tsx`
- `src/components/agents/wizard/quickSteps/StepQuickModel.tsx`
- `src/components/agents/wizard/quickSteps/StepQuickPrompt.tsx`

**Alterados:**
- `src/components/agents/CreateAgentWizard.tsx` — adiciona terceiro card "Criação rápida ⚡" na tela de escolha (`mode === "choose"`) e novo `mode === "quick"` que renderiza `<QuickCreateWizard />`

### Persistência

Salva via `supabaseExternal.from("agents").insert(...)` (mesmo padrão do wizard atual) com:
- `status: 'draft'`
- `persona`: derivada do tipo (sdr→specialist, analyst→analyst, etc.)
- `config.system_prompt`, `config.type`, `config.created_via: 'quick_wizard'`
- Redireciona para `/agents` com toast de sucesso

### Detalhes técnicos

- **react-hook-form** já está no projeto (`src/components/ui/form.tsx`)
- **zod** já em uso em `src/lib/validations/agentSchema.ts` — estendo seguindo o mesmo padrão
- **Sem mudanças de schema do banco** — usa tabela `agents` existente
- **Design tokens semânticos** apenas (primary, secondary, muted, nexus-emerald, nexus-amber, destructive) — sem cores hard-coded
- **Acessibilidade**: `aria-invalid`, `aria-describedby` automáticos via `<FormControl>`, navegação 100% por teclado

