

## Retomada inteligente: focar no primeiro campo inválido + destaque visual

Hoje `restoreDraft` calcula `resumeIdx` apenas com `STEPS[i].schema.safeParse(form).success`. Isso leva ao **passo** correto, mas dentro dele o usuário ainda precisa caçar o campo problemático. Vou:

1. Calcular o **primeiro campo inválido** (não só o passo) usando os campos declarados em `STEPS[i].fields`.
2. Propagar esse campo para os steps quick e renderizar um **destaque visual** (ring + scroll/focus automático).

### Cálculo do "primeiro campo inválido"

Nova função pura em `draftStore.ts`:

```ts
export interface DraftResumeTarget {
  stepIdx: number;             // 0..STEPS.length-1
  stepKey: 'identity' | 'type' | 'model' | 'prompt';
  field?: keyof QuickAgentForm; // campo pendente, se houver
}

export function computeResumeTarget(
  form: QuickAgentForm,
  steps: ReadonlyArray<{ key: string; schema: z.ZodTypeAny; fields: readonly string[] }>,
): DraftResumeTarget;
```

Lógica: percorre `STEPS` na ordem; no primeiro step que falha o `safeParse`, usa `error.errors[0].path[0]` para extrair o campo. Se o caminho for vazio (erros de `superRefine` em `prompt`), faz fallback para o **primeiro campo da lista do step que esteja vazio/inválido por heurística simples** (ex.: `prompt.trim().length < 50`). Se nenhum step falha, retorna o último step com `field: undefined`.

### Destaque visual no campo

- Estado novo no wizard: `highlightField: keyof QuickAgentForm | null`.
- Setado em `restoreDraft` após escolher o passo; limpo automaticamente após **3.5s** via `setTimeout` ou no primeiro `update()` do form.
- Cada `StepQuick*` recebe prop opcional `highlightField?: keyof QuickAgentForm`.
- Cada campo cuja `id` corresponda ao `highlightField` ganha:
  - `ring-2 ring-warning ring-offset-2 ring-offset-background animate-pulse-glow` (já existe no design system; senão usa `animate-pulse`).
  - `data-highlight="true"` para hook de scroll.
- `useEffect` no step monta → se `highlightField` presente, faz `document.getElementById(\`qa-\${field}\`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })` e chama `.focus()` no input correspondente.

### Toast atualizado

```ts
toast.success('Rascunho restaurado', {
  description: target.field
    ? `Continue em "${STEPS[target.stepIdx].label}" — campo: ${FIELD_LABEL[target.field]}`
    : `Continuando do passo: ${STEPS[target.stepIdx].label}`,
});
```

`FIELD_LABEL` mapeia `name → "Nome"`, `emoji → "Emoji"`, `mission → "Missão"`, `type → "Tipo"`, `model → "Modelo"`, `prompt → "Prompt"`, `description → "Descrição"`.

### Mudanças por arquivo

**`src/components/agents/wizard/draftStore.ts`**
- Adicionar `computeResumeTarget(form, steps)` puro.
- Mantém `checkDraftRestorable` atual.

**`src/components/agents/wizard/QuickCreateWizard.tsx`**
- Importar `computeResumeTarget`.
- Em `restoreDraft`: substituir cálculo atual por `const target = computeResumeTarget(target.form, STEPS);` → `setStep(target.stepIdx)` + `setHighlightField(target.field ?? null)`.
- Adicionar `highlightField` state + efeito de auto-clear (3.5s e em `update()`).
- Repassar `highlightField` (apenas quando o step atual contém aquele campo) para `StepQuickIdentity`, `StepQuickType`, `StepQuickModel`, `StepQuickPrompt`.
- `FIELD_LABEL` map para o toast.

**`src/components/agents/wizard/quickSteps/StepQuickIdentity.tsx`**
- Aceitar prop `highlightField?: keyof QuickAgentForm`.
- Helper `highlightCls(field)` → retorna classe extra `ring-2 ring-warning ring-offset-2 ring-offset-background animate-pulse` se bater.
- Aplicar no `Input`/`Textarea` de `name`, `emoji`, `mission`, `description`.
- `useEffect` para scroll + focus quando `highlightField` mudar.

**`src/components/agents/wizard/quickSteps/StepQuickType.tsx`** e **`StepQuickModel.tsx`** e **`StepQuickPrompt.tsx`**
- Mesmo padrão: aceitar `highlightField`, aplicar destaque no container do campo correspondente (`type`, `model`, `prompt`), scroll+focus no mount.

### Arquivos

- **Editar**: `src/components/agents/wizard/draftStore.ts`
- **Editar**: `src/components/agents/wizard/QuickCreateWizard.tsx`
- **Editar**: `src/components/agents/wizard/quickSteps/StepQuickIdentity.tsx`
- **Editar**: `src/components/agents/wizard/quickSteps/StepQuickType.tsx`
- **Editar**: `src/components/agents/wizard/quickSteps/StepQuickModel.tsx`
- **Editar**: `src/components/agents/wizard/quickSteps/StepQuickPrompt.tsx`

### Impacto

- Usuário cai exatamente no campo que falta corrigir, com pulso visual + foco automático — zero caça.
- Pure function `computeResumeTarget` é testável isoladamente (sem React).
- Destaque some sozinho ao primeiro toque, evitando ruído visual persistente.
- Zero mudança em backend/store schema.

