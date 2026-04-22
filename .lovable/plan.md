

## Correções automáticas com prévia ("Auto-fix")

Hoje o `PromptValidationFeedback` mostra erros e warnings, mas a única forma de corrigir é **manualmente**: o usuário lê "Linha 47 excede 500 chars" e tem que ir achar e quebrar a linha sozinho. As funções de limpeza (`sanitizePromptInput`) só rodam em paste novo — conteúdo já no editor que tenha sujeira não é tocado.

A mudança expõe os **fixers** como ações 1-clique no painel de validação, com **prévia diff** antes de aplicar.

### O que muda na visão do usuário

Quando há issues fixáveis, aparece uma nova seção **"Correções automáticas disponíveis"** dentro do `PromptValidationFeedback`, abaixo dos erros/warnings:

1. **Chips de fix** — um por correção aplicável, com badge do impacto:
   - `🧹 Remover caracteres invisíveis` — `−12 chars` (só aparece se sanitizer detecta `removedControl + removedZeroWidth + removedTags > 0`).
   - `📏 Compactar linhas em branco` — `−4 linhas` (se `consecutiveEmptyBlocks > 0`).
   - `✂️ Quebrar linhas longas` — `3 linhas afetadas` (se `longLines.length > 0`, quebra em `MAX_LINE_LENGTH` no espaço mais próximo).
   - `📐 Truncar para o limite` — `−1.230 chars do final` (se `exceedsCharLimit`).
   - `🪄 Aplicar tudo` — botão primary que combina todos acima em uma transformação.
2. **Botão "Pré-visualizar"** ao lado de cada chip → abre `Dialog` com **diff lado a lado** (antes vs. depois), contagem de mudanças, e botões `Aplicar` / `Cancelar`.
3. **Aplicação direta** (sem prévia) por click simples no chip → toast com resumo (`"Removidos 12 caracteres invisíveis · prompt agora tem 3.420 chars"`) e ação **Desfazer** (5s) que restaura o estado anterior.
4. **Estado vazio**: quando não há nada a corrigir, a seção não renderiza (UI limpa para prompts saudáveis).

### Como funciona (técnico)

**Novo arquivo** `src/lib/promptAutoFixers.ts` — funções puras, testáveis:

```ts
export interface FixResult {
  fixed: string;
  removedChars: number;
  removedLines: number;
  affectedLines: number[];
  description: string;
}

export function fixInvisibleChars(prompt: string): FixResult;     // reusa CONTROL_CHARS_RE/ZERO_WIDTH_RE/DANGEROUS_TAGS_RE
export function fixEmptyBlocks(prompt: string): FixResult;        // colapsa runs >MAX_EMPTY_BLOCK em exatamente MAX_EMPTY_BLOCK
export function fixLongLines(prompt: string): FixResult;          // quebra em MAX_LINE_LENGTH no último espaço, fallback hard-break
export function fixExceedsCharLimit(prompt: string): FixResult;   // slice(0, MAX_TOTAL)
export function applyAllFixes(prompt: string): FixResult;         // pipeline: invisíveis → linhas vazias → linhas longas → truncate

export interface AvailableFix {
  id: 'invisible' | 'empty' | 'longLines' | 'truncate';
  label: string;
  icon: string;
  result: FixResult;
}
export function detectAvailableFixes(prompt: string): AvailableFix[];
```

**Novo componente** `src/components/agents/wizard/quickSteps/PromptAutoFixPanel.tsx`:

- Props: `{ prompt: string; onApply: (fixed: string, summary: string) => void }`.
- Usa `detectAvailableFixes(prompt)` em `useMemo([prompt])`.
- Renderiza chips dos fixes disponíveis + botão "Aplicar tudo" + botão "Pré-visualizar" por chip.
- `Dialog` interno (shadcn) com `<pre>` lado a lado: texto atual à esquerda, corrigido à direita; linhas alteradas marcadas com fundo amber/destructive. Mostra contagem `−X chars · −Y linhas` no header.

**Editar** `src/components/agents/wizard/quickSteps/PromptValidationFeedback.tsx`:

- Aceitar prop opcional `onApplyFix?: (fixed: string, summary: string) => void`.
- Renderizar `<PromptAutoFixPanel prompt={prompt} onApply={onApplyFix} />` após a seção de warnings, **somente** se `onApplyFix` estiver presente e houver fixes disponíveis.

**Editar** `src/components/agents/wizard/quickSteps/StepQuickPrompt.tsx`:

- Manter `prevPromptRef = useRef<string>('')` atualizada antes de cada fix.
- Passar `onApplyFix={(fixed, summary) => { prevPromptRef.current = form.prompt; handleManualEdit(fixed); toast.success(summary, { action: { label: 'Desfazer', onClick: () => handleManualEdit(prevPromptRef.current) } }); }}`.

### Casos cobertos

| Cenário | Comportamento |
|---|---|
| Colei do Word com zero-width chars | Chip "Remover caracteres invisíveis · −7 chars"; click aplica; toast com Desfazer. |
| Prompt com 8 linhas em branco seguidas | Chip "Compactar linhas em branco · −5 linhas"; prévia mostra onde colapsa. |
| Linha 47 com 720 chars | Chip "Quebrar linhas longas · 1 linha afetada"; prévia mostra a linha quebrada em 2. |
| Prompt 9.230 chars (limit 8.000) | Chip "Truncar para o limite · −1.230 chars do final"; prévia mostra o que será cortado. |
| Múltiplos problemas | Botão "🪄 Aplicar tudo" roda o pipeline; prévia mostra resultado final. |
| Click "Desfazer" no toast | `handleManualEdit(prevPromptRef.current)` restaura. |
| Prompt já limpo | Seção inteira não aparece (sem ruído). |

### Arquivos tocados

- **Criar** `src/lib/promptAutoFixers.ts` (~180 linhas, puro).
- **Criar** `src/components/agents/wizard/quickSteps/PromptAutoFixPanel.tsx` (~200 linhas).
- **Editar** `src/components/agents/wizard/quickSteps/PromptValidationFeedback.tsx` — nova prop opcional + render condicional.
- **Editar** `src/components/agents/wizard/quickSteps/StepQuickPrompt.tsx` — wiring do callback com toast Desfazer.

### Impacto

- Zero schema/backend.
- Zero quebra: prop `onApplyFix` é opcional; sem ela o feedback segue só leitura como hoje.
- Reaproveita regexes do `promptSanitizer` — fixers consistentes com a sanitização de paste.
- Resolve o gap entre "detectar problema" e "consertar problema": um clique vs. caça manual no editor.

