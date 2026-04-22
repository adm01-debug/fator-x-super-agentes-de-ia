

## Checklist 4/4 em tempo real, sincronizado com a variação selecionada

Hoje o `PromptSectionChecklist` já recalcula em tempo real conforme o `prompt` (via `analyzeSectionContent` memoizado). O que falta é:

1. **Mostrar a variação ativa** dentro do próprio checklist (Equilibrado / Conciso / Detalhado / Customizado), para o usuário entender que o "4/4" é relativo ao que aquela variação **espera entregar**.
2. **Destacar visualmente as seções que a variação selecionada já preencheria** vs. as que continuam em falta no texto atual.
3. **Ação de 1 clique "Completar com a variação X"** que insere apenas as seções faltantes a partir do template da variação selecionada (sem sobrescrever o que o usuário já escreveu).

### O que muda na visão do usuário

- O cabeçalho do checklist agora exibe um **chip da variação ativa** (ex.: `Conciso`) ao lado do `4/4 ✓`.
  - Em modo customizado/locked, mostra `Customizado 🔒` em âmbar.
- Cada item da lista (Persona / Escopo / Formato / Regras) ganha um **mini-indicador** do que a variação ativa entregaria:
  - ✅ verde: já preenchido no texto e atende ao mínimo.
  - 🟡 âmbar: presente mas raso (já existe hoje).
  - ⚪ vazio: faltando — e mostra prévia *"a variação X preenche com ~42 palavras"*.
- Botão principal muda de `Inserir as N pendentes` para **`Completar com Conciso`** quando há variação ativa — e usa os snippets dela em vez dos snippets genéricos.
- Quando o usuário está em **modo customizado travado**, o botão volta a usar os snippets genéricos atuais (comportamento de hoje), com label `Inserir esqueletos pendentes`.
- O `4/4` recalcula instantaneamente a cada digitação (já é o caso) e a "fonte de verdade" do snippet de cada item passa a ser a variação ativa.

### Como funciona (técnico)

**1. Extrator de seção a partir de uma variante** (`src/lib/promptSectionLocator.ts` — nova função pura):
```ts
export function extractSectionFromPrompt(prompt: string, key: PromptSectionKey): string | null
```
- Reusa `findSectionLineIndex` + a lógica já existente em `analyzeSectionContent` para fatiar o bloco de heading até o próximo heading canônico.
- Retorna o trecho `## Heading\n…body…` ou `null` se a variação não tem essa seção.

**2. Snippets dinâmicos baseados na variação ativa** (`PromptSectionChecklist.tsx`):
- Nova prop opcional `activeVariantPrompt?: string` e `activeVariantLabel?: string`.
- `effectiveSnippets[key] = extractSectionFromPrompt(activeVariantPrompt, key) ?? SECTION_SNIPPETS[key]` (fallback no genérico).
- O contador `wordsFromVariant` é mostrado como prévia ao lado dos itens faltantes.

**3. Cabeçalho com chip da variação**:
- Renderiza o badge `meta.label` (importado de `PROMPT_VARIANT_META`) com cor primária quando há variação ativa, ou `Customizado` âmbar (com `Lock` se `customLocked`).

**4. Wiring no `StepQuickPrompt.tsx`**:
- Calcula `activeVariantPrompt = activeVariant ? template.promptVariants[activeVariant].prompt : null`.
- Passa `activeVariantPrompt`, `activeVariantLabel`, `customLocked` para o `PromptSectionChecklist`.
- O callback `onInsert(snippet, key)` continua igual — o checklist já passa o snippet correto (variant ou genérico).

**5. Botão "Completar com X"**:
- Quando há variação ativa e `incompleteKeys.length > 0`:
  - Label: `Completar com {label da variação}`.
  - Insere, em ordem canônica, **apenas** as seções faltantes usando os snippets da variação.
  - Mantém a chamada via `onInsert(snippet, key)` que já usa `insertSectionAt` para colocar cada seção na posição canônica correta — sem quebrar o que o usuário já escreveu.
- Quando não há variação (modo custom travado), comportamento atual preservado.

### Casos cobertos

| Cenário | Comportamento |
|---|---|
| Aplico "Conciso" e apago a seção "Regras" | Checklist mostra 3/4, badge `Conciso`, botão `Completar com Conciso` reinsere a "Regras" do template Conciso. |
| Modo custom travado, falta "Formato" | Badge `Customizado 🔒`, botão `Inserir esqueletos pendentes` usa snippet genérico. |
| Digitando dentro de uma seção rasa | Contador `4/4` atualiza em tempo real conforme as palavras passam de 8 (já funciona; só passa a refletir também o badge da variação). |
| Troco de "Conciso" para "Detalhado" sem editar | Badge muda, snippets de fallback passam a ser do "Detalhado" — nada é reescrito automaticamente. |

### Arquivos tocados

- **Editar** `src/lib/promptSectionLocator.ts` — adicionar `extractSectionFromPrompt(prompt, key)`.
- **Editar** `src/components/agents/wizard/quickSteps/PromptSectionChecklist.tsx` — props novas (`activeVariantPrompt`, `activeVariantLabel`, `customLocked`), badge da variação, snippets dinâmicos, label do botão "Completar com X".
- **Editar** `src/components/agents/wizard/quickSteps/StepQuickPrompt.tsx` — calcular `activeVariantPrompt` / `activeVariantLabel` e propagar ao checklist.

### Impacto

- Zero mudança de schema/backend.
- Zero quebra: assinaturas existentes mantidas (props novas são opcionais).
- O `4/4` continua sendo calculado pela mesma `analyzeSectionContent` memoizada — já era em tempo real, agora ganha contexto visual da variação ativa.
- "Completar com X" reduz cliques em prompts que vieram de uma variação e tiveram seções apagadas/colapsadas durante a edição.

