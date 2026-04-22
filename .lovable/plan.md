

## Realce no editor + indicador visual de onde inserir cada heading faltante

Hoje, ao clicar em "Inserir" no checklist, o snippet é **anexado ao final** do prompt e o usuário não vê onde foi parar. E quando uma seção está rasa/faltando, não há nenhum indicador visual no editor mostrando o local exato.

### O que vai mudar (visão do usuário)

1. **Régua de seções ao lado do editor** — uma faixa vertical fina à esquerda do textarea com 4 marcadores empilhados (Persona / Escopo / Formato / Regras). Cada marcador mostra:
   - 🟢 verde quando a seção existe e tem conteúdo suficiente
   - 🟡 âmbar pulsante quando existe mas está rasa
   - ⭕ cinza tracejado quando está faltando
   - Hover/clique no marcador → rola até a linha do heading (ou até o ponto de inserção sugerido) e seleciona a área no textarea.

2. **Realce inline na linha do heading rasa/faltante**
   - Para seções **rasas** (existem mas curtas): a linha do `## Persona` recebe um destaque âmbar via uma camada `<pre>` espelhada por trás do textarea (técnica padrão de overlay highlight em textarea — mesma fonte mono, mesmo padding, `pointer-events: none`).
   - Para seções **faltantes**: o overlay desenha um marcador fantasma `## Persona ⊕ inserir aqui` na posição sugerida (fim do bloco anterior ou final do prompt), em âmbar tracejado.

3. **Inserção contextual com posicionamento inteligente**
   - O "Inserir" do checklist passa a inserir o snippet **na posição correta**, na ordem canônica (Persona → Escopo → Formato → Regras), não mais só no final.
   - Após inserir, o cursor é posicionado dentro do bloco recém-inserido (na linha do primeiro `- `) e a área é destacada por 2s com pulso âmbar→verde.

4. **Mensagem flutuante acima do editor** quando `promptHighlight` ativa, do tipo: *"Faltam 2 seções: Escopo, Regras — clique nos marcadores 🟡 ao lado do editor para ir direto ao ponto."*

### Como vai funcionar (técnico)

**Novo arquivo `src/lib/promptSectionLocator.ts`** — utilitário puro:
```ts
export interface SectionLocation {
  key: PromptSectionKey;
  label: string;
  status: 'ok' | 'thin' | 'missing';
  // Para 'ok'/'thin': linha 0-indexed do heading existente.
  // Para 'missing': linha onde DEVE ser inserido (antes da próxima seção canônica
  // existente, ou final do prompt).
  headingLine: number;
  // Range de caracteres do bloco completo da seção (heading + body), para selectionRange.
  startChar: number;
  endChar: number;
  // Sugestão de inserção (apenas 'missing'): índice de char onde colar o snippet.
  insertChar: number;
}

export function locateSections(prompt: string): SectionLocation[];
```
Reaproveita `analyzeSectionContent` + `extractHeadings` do `quickAgentSchema.ts`. Para a posição de inserção de uma seção faltante: encontra a próxima seção canônica que **existe** depois dela na ordem `[persona, scope, format, rules]` — insere antes; se não houver, anexa ao final com 2 quebras de linha de margem.

**Novo componente `src/components/agents/wizard/quickSteps/PromptSectionGutter.tsx`**
- Recebe `locations: SectionLocation[]`, `onJump: (loc) => void`.
- Renderiza coluna fixa de ~28px de largura à esquerda do textarea, com 4 botões verticais distribuídos proporcionalmente à altura (cada um posicionado em `top: (headingLine / totalLines) * 100%` quando OK/thin; ou no slot livre entre seções vizinhas quando missing).
- Tooltip em cada marcador com label + status + linha.

**Novo componente `src/components/agents/wizard/quickSteps/PromptHighlightOverlay.tsx`**
- `<pre>` posicionado absolutamente sobre o textarea (`pointer-events:none`), espelha exatamente o conteúdo com:
  - Linhas normais → `color: transparent`
  - Linha de heading de seção **thin** → fundo `bg-warning/15` + borda esquerda âmbar
  - Linha **missing** → renderiza placeholder fantasma `## {Label} ← inserir aqui` em `text-warning/60 italic`
- Sincronizado com `scrollTop`/`scrollLeft` do textarea via ref + listener de scroll.
- Usa exatamente a mesma classe de fonte/padding/line-height do `Textarea` para alinhamento perfeito.

**Refatoração de `StepQuickPrompt.tsx`**
- Envolve o `<Textarea>` num `<div className="relative">` com:
  - `<PromptSectionGutter>` à esquerda (absolute)
  - `<PromptHighlightOverlay>` por trás do textarea (absolute, z-0)
  - `<Textarea>` com `padding-left` ajustado para abrir espaço para a régua, `bg-transparent` e z-10
- Nova função `jumpToSection(loc)` que:
  - Para `ok`/`thin`: posiciona caret no início do heading, faz `scrollIntoView` proporcional, seleciona o range `startChar`–`endChar`.
  - Para `missing`: posiciona caret em `insertChar`, faz scroll, e dispara o destaque pulse âmbar por 2s via state local `pulseRange`.

**Refatoração de `PromptSectionChecklist.tsx`**
- Substitui `onInsert(snippet)` por `onInsertAt(key, snippet)`.
- O pai recebe a key, calcula `insertChar` via `locateSections`, e faz `update('prompt', before + snippet + after)` em vez de concatenar no final.
- Botões individuais ("Inserir") e o botão em massa ("Inserir as N pendentes") usam o mesmo caminho ordenado.

**Refatoração de `PromptSectionGutter` ↔ `StepQuickPrompt`**
- O step passa `locations` (memoizado) e `onJump`. O gutter é dumb.

### Arquivos tocados

- **Novo** `src/lib/promptSectionLocator.ts` — locator puro testável.
- **Novo** `src/components/agents/wizard/quickSteps/PromptSectionGutter.tsx`
- **Novo** `src/components/agents/wizard/quickSteps/PromptHighlightOverlay.tsx`
- **Editar** `src/components/agents/wizard/quickSteps/StepQuickPrompt.tsx` (wrapper relativo, jump handler, inserção posicionada)
- **Editar** `src/components/agents/wizard/quickSteps/PromptSectionChecklist.tsx` (assinatura do callback `onInsertAt(key, snippet)`)

### Impacto

- Zero mudança de schema/backend.
- Zero quebra em `quickAgentSchema.ts` — só consome funções já existentes.
- Snippets agora caem no lugar certo, na ordem canônica — reduz prompts bagunçados.
- Visual claro de "está faltando AQUI" sem precisar abrir o checklist.

