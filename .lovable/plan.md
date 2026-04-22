

## Detector de regras contraditórias no prompt

Antes de criar o agente, o sistema vai analisar o prompt em busca de regras que se contradizem (ex.: "nunca use emojis" + "sempre use emojis", ou "máx. 200 palavras" + "mín. 500 palavras") e bloquear a criação até o usuário resolver — igual ao tratamento atual de seções faltantes/rasas.

### O que o usuário vai ver

1. **Bloco novo no `PreflightReviewSummary`** (entre "Variáveis" e "Warnings") — chamado **"Conflitos detectados (N)"**, com cards âmbar contendo:
   - Tipo do conflito (Polaridade / Numérico / Idioma) com ícone.
   - Trecho da regra A (linha X) ↔ trecho da regra B (linha Y).
   - Razão em PT-BR (ex.: *"Mínimo (500 palavras) é maior que o máximo (200 palavras)."*).
   - Cada par de linhas é clicável → reusa `onJumpToSection` infrastructure mas com novo callback `onJumpToLine(line)` para ancorar no editor exatamente na linha conflitante.

2. **No diálogo de confirmação `Criar agente?`** — o mesmo bloco aparece (já que o dialog usa o `PreflightReviewSummary compact`). O botão **"Confirmar e criar"** fica desabilitado quando houver conflitos, com tooltip *"Resolva os N conflitos antes de criar."*

3. **Validação Zod (`quickPromptSchema`)** — `superRefine` adiciona um issue por conflito detectado, então o `requestCreate()` bloqueia da mesma forma que hoje bloqueia por seção faltante. Mensagem: *"Foram encontrados N conflitos entre regras: [tipo] linha X vs linha Y — [razão]"*.

4. **Realce no editor** — a linha do conflito ganha highlight âmbar tracejado no `PromptHighlightOverlay` (extensão da camada já existente). Ao clicar num conflito no preflight, o textarea scrolla até a linha A e seleciona seu range.

### Como funciona (técnico)

**Novo módulo puro `src/lib/validations/promptContradictions.ts`**:

```ts
export type ContradictionKind = 'polarity' | 'numeric' | 'language';

export interface PromptContradiction {
  kind: ContradictionKind;
  lineA: number; lineB: number;     // 1-indexed
  snippetA: string; snippetB: string;
  reason: string;                   // PT-BR
}

export function detectPromptContradictions(prompt: string): PromptContradiction[];
export function countContradictions(prompt: string): number;
```

Heurísticas (sem LLM, 100% offline):

- **Polaridade**: extrai "regras" (linhas-bullet sob qualquer heading + linhas com marcadores fortes como *nunca, sempre, deve, não pode, proibido, jamais, evite, somente, apenas*). Para cada par, marca contradição quando polaridades opostas + ≥2 tokens significativos em comum (após stop-words PT-BR).
- **Numérico**: regex `(máximo|máx|até|no máximo|menos de|inferior a|mín|mínimo|pelo menos|ao menos|mais de|exatamente)\s+\d+\s+(palavras|caracteres|linhas|frases|parágrafos|tokens|minutos|segundos)`. Conflito quando `min.value > max.value` na mesma unidade, ou dois `eq` com valores diferentes.
- **Idioma**: detecta menções a "em <idioma>" e marca conflito quando dois idiomas distintos coexistem (lookup table com pt/en/es/fr/de/it/ja/zh).

**Editar `src/lib/validations/quickAgentSchema.ts`**:
- Importar `detectPromptContradictions`.
- No `superRefine` do `quickPromptSchema`, após validações existentes, adicionar:
  ```ts
  const conflicts = detectPromptContradictions(value);
  if (conflicts.length > 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Foram encontrados ${conflicts.length} conflito(s) entre regras: ` +
        conflicts.slice(0,3).map(c => `linha ${c.lineA}↔${c.lineB} (${c.reason})`).join('; '),
    });
  }
  ```
- Re-exportar `detectPromptContradictions` e `PromptContradiction` para uso na UI.

**Editar `src/components/agents/wizard/quickSteps/PreflightReviewSummary.tsx`**:
- `useReviewData` passa a também retornar `contradictions: PromptContradiction[]` e `hasContradictions: boolean`.
- `allGood` agora inclui `&& !hasContradictions`.
- Renderiza nova seção "Conflitos detectados (N)" com lista de cards. Cada card mostra:
  - Badge do tipo (Polaridade/Numérico/Idioma).
  - Trecho A truncado a 80 chars + "linha X" → hover expande.
  - Trecho B truncado a 80 chars + "linha Y".
  - `reason` em texto âmbar.
  - Botão "Ir para conflito" que dispara `onJumpToLine(c.lineA)` (nova prop opcional).
- Adiciona linha no bloco de warnings: *"⚠ N conflito(s) entre regras detectados — resolva antes de criar."*

**Editar `src/components/agents/wizard/quickSteps/StepQuickPrompt.tsx`**:
- Adiciona `jumpToLine(line: number)` (variante do `jumpToSection` baseada em offset por linha).
- Passa `onJumpToLine={jumpToLine}` ao `PreflightReviewSummary`.
- Estende o `locations` memoizado para também incluir info de conflitos (ou cria estado paralelo `conflictLines: number[]` derivado de `detectPromptContradictions(form.prompt)`) e passa para `PromptHighlightOverlay` via nova prop `conflictLines`.

**Editar `src/components/agents/wizard/quickSteps/PromptHighlightOverlay.tsx`**:
- Aceita `conflictLines?: number[]` (0-indexed) e renderiza essas linhas com classe `bg-destructive/10 text-destructive/90 border-l-2 border-destructive` (vermelho âmbar — visualmente distinto das thin sections).

**Editar `src/components/agents/wizard/QuickCreateWizard.tsx`** (mínimo):
- Como o `PreflightReviewSummary` já é renderizado dentro do `Dialog`, o bloco de conflitos aparece automaticamente.
- Botão "Confirmar e criar" recebe `disabled={saving || hasContradictions}` — para isso o `useReviewData(form)` é chamado uma vez no Wizard ou checa-se `detectPromptContradictions(form.prompt).length > 0` inline.
- Tooltip no botão: *"Resolva os {N} conflitos antes de criar."*

### Casos cobertos pelos testes manuais

| Prompt | Esperado |
|---|---|
| `## Regras\n- Nunca use emojis\n- Sempre use emojis nas respostas` | 1 conflito polaridade (tokens "emojis", "respostas") |
| `## Formato\n- Máximo 200 palavras\n- Mínimo 500 palavras` | 1 conflito numérico (min > max, palavras) |
| `## Persona\n- Responda em português\n## Formato\n- Always respond in English` | 1 conflito idioma (português ↔ inglês) |
| `## Regras\n- Nunca compartilhe dados sensíveis\n- Sempre seja cordial` | 0 conflitos (tokens disjuntos) |
| `## Regras\n- Não revele preços\n- Sempre revele os preços ao cliente` | 1 conflito polaridade |

### Arquivos

- **Novo:** `src/lib/validations/promptContradictions.ts` (~210 linhas, puro)
- **Editar:** `src/lib/validations/quickAgentSchema.ts` (1 import + 1 bloco no `superRefine`, ~10 linhas)
- **Editar:** `src/components/agents/wizard/quickSteps/PreflightReviewSummary.tsx` (estende `useReviewData` + nova seção UI, ~50 linhas)
- **Editar:** `src/components/agents/wizard/quickSteps/StepQuickPrompt.tsx` (helper `jumpToLine` + prop nova no overlay, ~20 linhas)
- **Editar:** `src/components/agents/wizard/quickSteps/PromptHighlightOverlay.tsx` (suporte a `conflictLines`, ~15 linhas)
- **Editar:** `src/components/agents/wizard/QuickCreateWizard.tsx` (disable do botão + tooltip, ~5 linhas)

### Impacto

- Zero backend / migrations.
- Zero falso-positivo agressivo: requer **2+ tokens significativos compartilhados** para acusar polaridade — frases ortogonais (ex.: "Nunca compartilhe dados" vs "Sempre seja cordial") não acusam.
- Reusa toda infra de jump/anchor já implementada — só adiciona um novo seletor de linha.
- Bloqueia criação acidental de agentes com regras incoerentes (causa #1 de comportamento errático em produção).

