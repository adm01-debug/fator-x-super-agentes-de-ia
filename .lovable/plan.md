

## Validação em tempo real do editor de prompt

Adiciono validação ativa ao `<Textarea>` do passo 4 (Prompt) do wizard rápido, com contagem por linhas, bloqueio de caracteres inválidos (incluindo colagem) e mensagens PT-BR inline antes de avançar.

### Visão final do editor

```text
┌─ System Prompt ──────────────────────────────────────┐
│ [ Variações de prompt ]                              │
│                                                       │
│ ## Persona                                            │
│ Você é um SDR consultivo...                          │
│ ...                                                   │
│                                                       │
│ ⚠ Linha 14 contém caracteres não permitidos: <script>│
│                                                       │
│  ▰▰▰▰▰▰▰▱▱  2.140 / 8.000   ·   42 linhas / 200      │
└──────────────────────────────────────────────────────┘
[ ✓ Persona  ✓ Escopo  ✓ Formato  ✗ Regras ]
```

### Regras de validação (todas em tempo real)

| Regra | Limite | Comportamento |
|---|---|---|
| Caracteres totais | 50–8.000 | já existe; mantém barra |
| Linhas totais | máx 200 | nova; bloqueia digitação/colagem que ultrapasse |
| Linha individual | máx 500 chars | nova; aviso inline com nº da linha |
| Caracteres de controle | bloquear `\x00–\x08`, `\x0B–\x1F` exceto `\t \n \r` | strip silencioso na entrada/colagem |
| Tags HTML/script | bloquear `<script`, `<iframe`, `<object`, `<embed`, `javascript:` | strip + toast "Conteúdo removido por segurança" |
| Sequências zero-width | `\u200B \u200C \u200D \uFEFF` | strip silencioso (comum ao colar de Notion/Word) |
| Colagem > 8.000 chars | acima do limite | trunca + toast "Texto colado foi truncado para 8.000 caracteres" |
| Whitespace excessivo | >3 linhas em branco seguidas | aviso inline (não bloqueia) |

### Mensagens PT-BR inline (abaixo do textarea)

- `"Linha {n} excede 500 caracteres ({len})."`
- `"Limite de 200 linhas atingido."`
- `"Caracteres de controle removidos automaticamente."`
- `"Tags HTML perigosas removidas (segurança)."`
- `"Texto colado foi truncado: {removed} caracteres descartados."`
- `"Mais de 3 linhas em branco consecutivas — considere limpar."`

Erros bloqueantes em vermelho (`text-destructive`), avisos não-bloqueantes em âmbar (`text-nexus-amber`). Acumula em lista compacta com `role="alert"` para a11y.

### Bloqueio de avanço

Wizard só permite "Próximo" quando:
1. Schema atual passa (mín 50, máx 8.000, 4 seções) — **já existe**
2. Nenhum erro bloqueante ativo (linha >500, >200 linhas)

`StepQuickPrompt` expõe estado de erros via callback opcional ou o próprio `quickPromptSchema` ganha as novas regras (preferido — bloqueia automaticamente em `validateStep`).

### Arquivos a alterar

**1. `src/lib/validations/promptSanitizer.ts` (novo)**
- `sanitizePromptInput(text: string): { clean: string; warnings: string[]; removed: number }`
- `analyzePromptStructure(text: string): { lineCount: number; longLines: Array<{line:number;len:number}>; emptyBlocks: number }`
- Regex de strip para controle, zero-width e tags perigosas.
- Constantes: `MAX_LINES = 200`, `MAX_LINE_LENGTH = 500`, `MAX_TOTAL = 8000`.

**2. `src/lib/validations/quickAgentSchema.ts`**
- Adicionar superRefine no `quickPromptSchema`:
  - rejeita >200 linhas → `"Máximo 200 linhas (atual: {n})"`
  - rejeita qualquer linha >500 chars → `"Linha {n} muito longa (máx 500)"`
- Manter validações existentes (seções, length).

**3. `src/components/agents/wizard/quickSteps/PromptValidationFeedback.tsx` (novo)**
- Componente puro que recebe `prompt: string` e renderiza:
  - Linha de status: `{chars} / 8000 · {lines} / 200 linhas`
  - Lista compacta de erros/warnings com ícones (`AlertCircle` vermelho, `AlertTriangle` âmbar).
- Usa `analyzePromptStructure` + `getMissingSections`.

**4. `src/components/agents/wizard/quickSteps/StepQuickPrompt.tsx`**
- Novo handler `handleChange` que aplica `sanitizePromptInput` antes de `update('prompt', …)`.
- Novo handler `handlePaste` no Textarea: intercepta `e.clipboardData.getData('text')`, sanitiza, trunca para `MAX_TOTAL - currentLength`, insere na posição do cursor, dispara toast se houve corte/strip.
- Substitui o atual contador inline pelo `<PromptValidationFeedback>`.
- Mantém checklist de seções abaixo (já existe).

**5. `src/test/validations.test.ts`** (estender se já existir, senão criar caso pequeno)
- Casos: strip de `<script>`, truncamento em colagem, contagem de linhas longas, bloqueio em >200 linhas.

### Detalhes técnicos

- **Sanitização não destrutiva ao digitar normal**: regex só dispara quando padrão é detectado, então digitar texto comum é zero-overhead.
- **`onPaste` com `preventDefault`**: necessário para truncar antes do React reconciliar; usa `document.execCommand('insertText', false, clean)` com fallback para `setRangeText` no `inputRef`.
- **Performance**: `analyzePromptStructure` é O(n) em chars; rodado a cada keystroke (prompt máx 8KB, irrelevante). Sem `useMemo` — overhead seria maior que ganho.
- **i18n**: strings PT-BR diretas (consistente com restante do wizard rápido, que não usa `useI18n`).
- **Tokens semânticos**: `text-destructive`, `text-nexus-amber`, `bg-destructive/10`, `border-destructive/30`. Zero hex.
- **Acessibilidade**: container de erros com `role="alert"` e `aria-live="polite"`; warnings em `role="status"`.
- **Backward-compat**: prompts já salvos no banco não são reprocessados (sanitização só ocorre na entrada do wizard).
- **Compat com variações**: `applyPromptVariant` continua passando texto direto via `update`; os templates são limpos por construção, então não acionam strip.

### Impacto

- Usuário não consegue mais colar HTML malicioso, planilhas gigantes ou texto com formatação invisível do Word/Notion sem perceber.
- Wizard bloqueia avanço com mensagens claras em PT-BR antes do erro chegar ao backend.
- Zero migração, zero impacto em modos Avançado/Template do wizard maior.
- Reusable: `sanitizePromptInput` pode ser chamado depois em qualquer outro editor de prompt do app.

