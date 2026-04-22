

## Linha do tempo clicável por session_id com passo selecionado e resumo

A `ExecutionTimeline` atual lista os eventos da execução selecionada na lateral, mas cada item só funciona como toggle expandir/colapsar — não há "passo selecionado" navegável, e o resumo da execução fica fora do componente, no header da Card. Vou transformar a timeline em um listbox navegável com destaque do passo ativo, header de resumo embutido e contagens ✓/⚠/✗.

### Visão final

```text
┌─ [sticky] # session_abc123…              Passo 4 / 12 ┐
│  ✓ 8   ⚠ 2   ✗ 1    │  ⏱ 4320ms   ⚡ 1.4k tk   $0.00231 │
│  ↳ tool.invoke.success                       14:22:08   │
└─────────────────────────────────────────────────────────┘

┌ #1  14:22:01  ℹ  agent.start              45ms          ┐
├ #2  14:22:02  ℹ  llm.request           320ms 421 tk     ┤
├ #3  14:22:03  ⚠  guardrail.warn         12ms            ┤
█ #4  14:22:08  ℹ  tool.invoke.success   180ms ◄ ATIVO    █  ← bg-primary/10 + ring
│      ┌─ Input  / Output / Metadata expandidos ─┐         │
└ #5  14:22:09  ✗  tool.error             50ms            ┘
```

### Componentes / mudanças

**1. `src/components/agents/traces/ExecutionTimeline.tsx`** — refatoração:
- Nova interface: `{ execution, selectedStep?, onSelectStep? }` (controlado e não-controlado).
- Estado interno `internalStep` quando `selectedStep` não é passado; `setStep` faz clamp em `[0, traces.length-1]`.
- Reset automático quando `execution.session_id` muda.
- **Header de resumo embutido (sticky)** no topo do componente: `session_id` em `<code>` truncado, badge "Passo N / total", contagens coloridas `✓ info / ⚠ warning / ✗ error` (omite os zeros de warn/error), separador, depois `⏱ tempo total`, `⚡ tokens`, `$ custo`. Linha extra "↳ {evento atual} {hora}" para indicar o passo ativo.
- Cada `<li>` vira clicável com `role="option"` + `aria-selected`; ativo recebe `bg-primary/10 ring-1 ring-primary/30 shadow-sm`, número `#N` colorido em primary; inativo mantém o estilo `bg-card/40 hover:bg-muted/40`.
- Clicar em um item já não-ativo: seleciona e abre Input/Output/Metadata. Clicar de novo no ativo: alterna expandir/colapsar. Item ativo abre automaticamente.
- Container com `tabIndex={0}` + `onKeyDown`: `↑/k` passo anterior, `↓/j` próximo, `Home`/`End` extremos. Foco visível com ring.
- `scrollIntoView({ block: 'nearest', behavior: 'smooth' })` no item selecionado.
- `aria-activedescendant` aponta para `id="trace-{id}"` do item ativo (a11y para leitores de tela).
- `forwardRef` direto para `<li>` (sem o hack de `require('react')`).

**2. `src/pages/AgentTracesPage.tsx`** — pequenos ajustes:
- Novo state `const [selectedStep, setSelectedStep] = useState(0)`; reseta para 0 quando `selectedId` muda (`useEffect`).
- Passar `selectedStep` + `onSelectStep` para `<ExecutionTimeline>`.
- Como o resumo da execução agora vive **dentro** da timeline, simplifico o `CardHeader` da Card "Linha do tempo": tiro a linha mono com session/eventos/ms (vira redundante) e mantenho só o título + botão Replay no topo. Isso ganha espaço vertical e elimina duplicação.
- O botão Replay continua abrindo o `ReplayDialog` na execução selecionada — sem mudança.

### Arquivos

- **Editar**: `src/components/agents/traces/ExecutionTimeline.tsx` — props controladas, header de resumo sticky, item ativo destacado, navegação por teclado, scroll-into-view, a11y de listbox.
- **Editar**: `src/pages/AgentTracesPage.tsx` — state `selectedStep`, reset por sessão, simplificação do header da Card.

### Impacto

- Usuário navega passo a passo com clique ou teclado, sem precisar abrir o modal de replay.
- O resumo (✓/⚠/✗ + tempo + tokens + custo) fica visível enquanto rola a timeline (sticky), dando contexto permanente da execução.
- Destaque visual claro do passo selecionado (ring + bg primário) elimina ambiguidade ao alternar entre eventos.
- Zero mudança de schema, serviço ou store; tudo é estado de UI local.

