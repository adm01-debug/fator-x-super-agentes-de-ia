

## Diagnóstico detalhado de validação ("Por que falhou?")

Hoje o `PromptValidationFeedback` mostra mensagens curtas como _"Linha 47 excede 500 caracteres (612)"_ ou _"Tags HTML perigosas removidas"_, mas **não** mostra:

- **Qual regra interna** disparou (ex: `CONTROL_CHARS_RE`, `DANGEROUS_TAGS_RE`, `exceedsLineLimit`).
- **Quantas ocorrências** existem por tipo (3 zero-widths, 2 tags `<script>`, 5 linhas longas).
- **Qual trecho exato** do prompt foi flagrado — o usuário ainda precisa caçar manualmente.

Falta um **diagnóstico transparente** que abre cada issue em forma de "auditoria": regra, contagem, amostra do trecho com posição (linha:coluna), e ação rápida (pular para o trecho ou aplicar o auto-fix correspondente).

### O que muda na visão do usuário

Abaixo das listas atuais de erros/warnings (e acima do painel de Auto-fix), aparece um novo bloco colapsável **"Diagnóstico técnico"** com um botão `Ver detalhes (N regras)`. Ao expandir, mostra uma **lista de cards**, um por regra detectada:

```
┌─ 🔴 control_chars · Caracteres de controle ─────────────┐
│ Regra: /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/                │
│ Ocorrências: 3 · Linhas afetadas: 12, 47, 88             │
│                                                          │
│ Amostra (linha 47, col 23):                              │
│   "...descrição da \x07tarefa principal..."              │
│                       ^                                  │
│                                                          │
│ [Ir para linha 47]  [Aplicar correção]                   │
└──────────────────────────────────────────────────────────┘
```

Cada card mostra:
1. **Severidade + ID da regra** (`error` vermelho / `warning` âmbar) — ex: `control_chars`, `zero_width`, `dangerous_html`, `js_uri`, `long_line`, `empty_block`, `exceeds_chars`, `exceeds_lines`.
2. **Descrição PT-BR** do que a regra valida e por quê.
3. **Padrão / limite** que disparou (regex resumida ou número-limite em mono).
4. **Contagem** de ocorrências + lista de **linhas afetadas** (até 5, depois `+N`).
5. **Amostra contextualizada**: 30 chars antes e depois do match na primeira ocorrência, com `^` apontando a coluna exata. Caracteres invisíveis aparecem escapados (`\x07`, `\u200B`).
6. **Ações**: `Ir para linha X` (foca o textarea + scroll + seleciona o trecho) e — quando há fixer correspondente — `Aplicar correção` (delega ao `onApplyFix` existente, mesma lógica do auto-fix panel).

Quando **não** há issues, o bloco inteiro não renderiza (UI limpa).

### Como funciona (técnico)

**1. Estender `promptSanitizer.ts`** com uma nova função `diagnosePrompt(prompt)` que devolve issues estruturadas (sem quebrar `getPromptIssues` existente, que continua para retro-compat):

```ts
export interface PromptDiagnosticIssue {
  id: 'control_chars' | 'zero_width' | 'dangerous_html' | 'js_uri'
    | 'long_line' | 'empty_block' | 'exceeds_chars' | 'exceeds_lines';
  level: 'error' | 'warning';
  title: string;            // "Caracteres de controle"
  description: string;      // explicação PT-BR do porquê
  rulePattern: string;      // regex/limite legível
  occurrences: number;
  affectedLines: number[];
  sample?: {
    line: number;
    column: number;
    context: string;        // 30 chars antes + match + 30 depois
    matchStart: number;     // offset relativo ao context, para o caret ^
    matchLength: number;
    escapedMatch?: string;  // "\x07" / "\u200B" para invisíveis
  };
  fixerId?: 'invisible' | 'longLines' | 'truncate' | 'empty';
}

export function diagnosePrompt(prompt: string): PromptDiagnosticIssue[];
```

A função roda os mesmos regexes/análises que já existem (`CONTROL_CHARS_RE`, `ZERO_WIDTH_RE`, `DANGEROUS_TAGS_RE`, `JS_URI_RE`, `analyzePromptStructure`) e converte cada match em uma issue com `sample` calculada via `text.split('\n')` para linha/coluna.

**2. Criar `PromptDiagnosticsPanel.tsx`** (~180 linhas):

- Props: `{ prompt: string; onJumpToLine?: (line: number) => void; onApplyFix?: (fixerId, fixed, summary) => void }`.
- Usa `useMemo([prompt], () => diagnosePrompt(prompt))`.
- Header colapsável (`Collapsible` shadcn) com badge da contagem total.
- Renderiza um `<Card>` por issue com layout descrito acima.
- Amostra usa `<pre>` mono + linha do caret `^` alinhada via `padStart(matchStart, ' ')`.
- Botão `Ir para linha X` chama `onJumpToLine(line)`.
- Botão `Aplicar correção` aparece só se `fixerId` estiver presente — chama o fixer já exportado de `promptAutoFixers.ts` e delega `onApplyFix`.

**3. Editar `PromptValidationFeedback.tsx`** — adicionar:

- Nova prop opcional `onJumpToLine?: (line: number) => void`.
- Render de `<PromptDiagnosticsPanel prompt={prompt} onJumpToLine={onJumpToLine} onApplyFix={...} />` entre os warnings e o `PromptAutoFixPanel`.

**4. Editar `StepQuickPrompt.tsx`** — implementar `handleJumpToLine(line)`:

- Calcula offset do início da linha (`prompt.split('\n').slice(0, line-1).join('\n').length + 1`).
- `textareaRef.current.focus()` + `setSelectionRange(start, end-da-linha)` + `scrollTop` proporcional.
- Passa `onJumpToLine={handleJumpToLine}` para o `PromptValidationFeedback`.

### Casos cobertos

| Cenário | Diagnóstico exibido |
|---|---|
| Colei texto com `\x07` na linha 12 | Card `control_chars` · 1 ocorrência · linha 12 · amostra com `\x07` escapado · botões Ir/Aplicar. |
| 3 zero-widths em linhas 5, 8, 22 | Card `zero_width` · 3 ocorrências · amostra da primeira com `\u200B` visível · 1 botão Aplicar. |
| `<script>alert(1)</script>` colado | Card `dangerous_html` · 1 ocorrência · regra mostra `<script\|iframe\|...>` · amostra do trecho. |
| Linha 47 com 612 chars | Card `long_line` · 1 ocorrência · linha 47 · amostra dos primeiros 60 chars + `…` · Aplicar = quebra. |
| 2 blocos de 5 linhas em branco | Card `empty_block` warning · 2 ocorrências · linhas dos blocos · Aplicar = compacta. |
| Prompt 9.230/8.000 chars | Card `exceeds_chars` · mostra excesso · Aplicar = trunca. |
| Prompt limpo | Painel não renderiza. |
| Click `Ir para linha 47` | Textarea foca, scrolla até a linha, seleciona o conteúdo dela. |

### Arquivos tocados

- **Editar** `src/lib/validations/promptSanitizer.ts` — adicionar `diagnosePrompt()` + tipo `PromptDiagnosticIssue` (~120 linhas novas, sem alterar APIs existentes).
- **Criar** `src/components/agents/wizard/quickSteps/PromptDiagnosticsPanel.tsx` (~180 linhas).
- **Editar** `src/components/agents/wizard/quickSteps/PromptValidationFeedback.tsx` — nova prop `onJumpToLine` + render do painel (~5 linhas).
- **Editar** `src/components/agents/wizard/quickSteps/StepQuickPrompt.tsx` — implementar `handleJumpToLine` + passar prop (~15 linhas).

### Impacto

- **Zero schema/backend, zero dependência nova.**
- **Zero quebra**: `getPromptIssues` e `hasBlockingIssues` permanecem idênticos; a nova `diagnosePrompt` é aditiva. Props `onJumpToLine` e o painel são opcionais.
- Reaproveita 100% dos regexes/limites de `promptSanitizer.ts` e os fixers de `promptAutoFixers.ts` — uma fonte de verdade.
- Resolve a opacidade: o usuário deixa de ver "algo está errado" e passa a ver **qual regra**, **onde**, **quanto** e **como consertar** — em um só lugar.

