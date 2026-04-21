

## Prévia ao vivo detalhada do agente no passo Prompt

Substituo o card simples atual por um **AgentLivePreviewCard** rico que atualiza em tempo real (debounce 200ms) conforme o usuário edita qualquer campo do form.

### Visão final

```text
┌─ Prévia ao vivo ─────────────────────── atualiza ao vivo ─┐
│  ╭───╮  Marina SDR                          [chatbot]      │
│  │ 🤖│  modelo: gpt-4o · 4 seções ✓ · 2.140 chars         │
│  ╰───╯                                                      │
│                                                             │
│  Missão                                                     │
│  Qualificar leads inbound e agendar reuniões com SDRs...   │
│                                                             │
│  ─────────────────────────────────────────────────────     │
│                                                             │
│  Resumo do system prompt                  [ver completo ▾] │
│                                                             │
│  ## Persona                                                 │
│  Você é a Marina, SDR consultiva especializada em SaaS B2B │
│  ## Escopo                                                  │
│  • Qualificar leads via BANT                                │
│  • Agendar reuniões de discovery                            │
│  ## Formato                                                 │
│  Tom consultivo, respostas em até 3 parágrafos...          │
│  …+ 18 linhas                                               │
└────────────────────────────────────────────────────────────┘
```

### Conteúdo do card

1. **Cabeçalho** — emoji grande (h-14 w-14), nome em destaque, badge do tipo, linha de meta (modelo · seções detectadas X/4 · contagem de chars com cor semântica conforme limite).
2. **Missão** — bloco curto com a missão truncada em 2 linhas (`line-clamp-2`).
3. **Resumo do system prompt** — **primeiras 12 linhas não vazias** do prompt em mono, com fade-out no final se houver mais e contador `+N linhas`. Botão "ver completo" expande para mostrar tudo (até 40 linhas, com scroll interno).
4. **Indicador "atualiza ao vivo"** com dot pulsante quando houve mudança nos últimos 500ms.

### Arquivos a alterar

**1. `src/components/agents/wizard/quickSteps/AgentLivePreviewCard.tsx` (novo)**
- Props: `form: QuickAgentForm`.
- Usa `useDebounce(form, 200)` para evitar re-render por keystroke.
- Lógica `summarizePrompt(text, max=12)`: split por `\n`, filtra linhas com algo (mas preserva headings `##`), pega as primeiras N, devolve `{ preview: string, totalLines: number, hiddenLines: number }`.
- Estado local `expanded` para alternar 12 ↔ 40 linhas.
- Detecta seções via `detectPromptSections` (já existe em `quickAgentSchema`) e mostra contador X/4.
- Pulse de "atualizou agora" via `useEffect` que liga um `recentlyUpdated` por 500ms quando o debounced muda.

**2. `src/components/agents/wizard/quickSteps/StepQuickPrompt.tsx`**
- Remove o bloco antigo de "Pré-visualização" (`nexus-card` com emoji + name + mission) — substituído.
- Insere `<AgentLivePreviewCard form={form} />` no mesmo lugar.
- Mantém `CompiledPromptPreview` e `QuickAgentTestPanel` abaixo (são finalidades diferentes — um é o texto consolidado para o LLM, o outro é o teste real).

### Detalhes técnicos

- **Debounce**: usa `useDebounce(form, 200)` (já existe em `src/hooks/use-debounce.ts`) para prévia suave sem travar digitação.
- **Tipos**: `import type { QuickAgentForm } from '@/lib/validations/quickAgentSchema'`.
- **Tokens semânticos**: `bg-card`, `border-border/50`, `text-muted-foreground`, `bg-primary/15`, `text-primary`, `bg-nexus-amber` para indicador "atualiza ao vivo". Zero hex.
- **Acessibilidade**: dot pulsante com `aria-label="Atualizado agora"`; botão expandir com `aria-expanded`.
- **Performance**: `summarizePrompt` é O(n) em chars (prompt máx 8KB → irrelevante). Sem `useMemo`.
- **Responsivo**: card empilha em mobile (`flex-col sm:flex-row` no header).
- **Reuso**: o card pode ser arrastado depois para o modo Avançado sem mudanças.

### Impacto

- Usuário vê em tempo real como o agente está ficando enquanto edita o prompt (reduz "context switching" mental).
- Zero migração, zero impacto no schema, zero mudança em outros wizards.
- Reusa `useDebounce` e `detectPromptSections` já existentes.

