

## Persistir a variação de prompt selecionada no rascunho

Hoje o wizard usa `detectPromptVariant(type, prompt)` para inferir a chip ativa por **comparação textual exata** com o template. Resultado: ao voltar a um rascunho, se o prompt foi minimamente editado, a chip volta para "customizado" — e quando bate com algum template, sempre cai em "Equilibrado" (primeiro da ordem). A escolha explícita do usuário se perde.

A solução é guardar a **variação efetivamente escolhida** (`selectedVariant`) ao lado do prompt, persistir no draft e usá-la como fonte de verdade para a chip ativa.

### O que muda na visão do usuário

1. Ao clicar em **Conciso** (ou outra variação), a escolha é gravada no rascunho. Ao recarregar a página/voltar mais tarde, a chip "Conciso" volta destacada — mesmo que o texto bata com outra variação ou tenha sido levemente editado dentro do lock.
2. Quando o usuário **edita manualmente** o prompt (já existe `promptCustomLocked = true`), a chip "Customizado 🔒" aparece como hoje, mas a `selectedVariant` é zerada — porque a intenção do usuário deixou de ser uma variação fixa.
3. Ao **trocar o tipo de agente**, `selectedVariant` reseta junto com o lock (estado coerente para o novo template).
4. Ao clicar **"Restaurar template"** ou **"Sair do modo custom"**, `selectedVariant` é recalculada a partir do `detectPromptVariant` (auto) — comportamento atual preservado.
5. Ao clicar em **"Aplicar"** uma variação a partir do estado custom-locked → confirma no AlertDialog → aplica e grava `selectedVariant = variantId`.

### Como funciona (técnico)

**Novo estado no `QuickCreateWizard`**:
```ts
const [selectedVariant, setSelectedVariant] = useState<PromptVariantId | null>(null);
```

**Resolução da chip ativa** (substitui o cálculo direto em `StepQuickPrompt`):
```ts
// Em QuickCreateWizard, calculado e passado adiante:
const detected = detectPromptVariant(form.type, form.prompt);
const activeVariant = promptCustomLocked
  ? null
  : (selectedVariant ?? detected);
```
- Prioriza a escolha explícita; cai no auto-detect só quando o usuário nunca clicou em variação para o tipo atual.
- O `StepQuickPrompt` recebe `activeVariant` direto como prop em vez de calcular sozinho — fonte única de verdade.

**Setters que mexem na variação**:
| Ação | `selectedVariant` | `promptCustomLocked` |
|---|---|---|
| `doApplyPromptVariant(id)` | `setSelectedVariant(id)` | `false` |
| `applyTemplate(type)` | `setSelectedVariant(null)` (template padrão = balanced via auto-detect) | `false` |
| `restorePromptFromType()` | `setSelectedVariant(null)` | `false` |
| `updatePromptManual(...)` | `setSelectedVariant(null)` | `true` |
| Troca de `form.type` | `setSelectedVariant(null)` | `false` |
| `setPromptCustomLocked(false)` (botão "Sair do custom") | mantém `null` (já era custom) | `false` |

**Persistência no `DraftEntry`** (`draftStore.ts`):
- Adicionar campo opcional `selectedVariant?: PromptVariantId | null`.
- `upsertDraft({ form, promptCustomLocked, selectedVariant })` grava o campo.
- `loadDrafts()` lê e normaliza (null se inválido).

**Auto-save no wizard** (efeito atual de upsert):
```ts
upsertDraft(prev, { id, form, promptCustomLocked, selectedVariant })
```

**Restore** (`restoreDraft`):
```ts
setForm(target.form);
setPromptCustomLocked(target.promptCustomLocked === true);
setSelectedVariant(target.selectedVariant ?? null);
```

**`StepQuickPrompt`**:
- Nova prop `activeVariant: PromptVariantId | null` (vinda do wizard).
- Remove o cálculo local `detectPromptVariant(...)`; mantém `activeVariantPrompt` e `activeVariantLabel` derivados de `activeVariant`.
- Passa `activeVariant` para `PromptVariantSelector` exatamente como hoje.

### Arquivos tocados

- **Editar** `src/components/agents/wizard/QuickCreateWizard.tsx` — novo estado `selectedVariant`, resolução `activeVariant` centralizada, setters em todos os pontos da tabela acima, propagar para `StepQuickPrompt`, persistir via `upsertDraft` e restaurar via `restoreDraft`.
- **Editar** `src/components/agents/wizard/draftStore.ts` — campo `selectedVariant?: PromptVariantId | null` em `DraftEntry`, normalização em `loadDrafts`, leitura/escrita em `upsertDraft`.
- **Editar** `src/components/agents/wizard/quickSteps/StepQuickPrompt.tsx` — receber `activeVariant` como prop em vez de calcular; derivar label/prompt a partir dele.

### Casos cobertos

| Cenário | Comportamento |
|---|---|
| Aplico "Conciso" → fecho o navegador → volto | Chip "Conciso" destacada (não mais "Equilibrado" por auto-detect). |
| Aplico "Conciso" → edito 1 char → fecho → volto | Chip "Customizado 🔒" travada (lock vence; `selectedVariant` zerada na edição). |
| Nunca cliquei numa chip, prompt bate com "Detalhado" | Chip "Detalhado" via auto-detect (fallback). |
| Troco o tipo de "chatbot" → "sdr" | `selectedVariant` reseta; auto-detect roda no novo template. |
| Clico "Restaurar template" | `selectedVariant` zerada → auto-detect mostra "Equilibrado" (template padrão). |
| Clico "Sair do modo custom" sem escolher variação | Auto-detect volta a rodar; se o texto bater, mostra a chip correspondente. |

### Impacto

- Zero mudança de schema/backend — só localStorage.
- Backward-compat: drafts antigos sem `selectedVariant` continuam funcionando (campo opcional, `null` por padrão = comportamento atual de auto-detect).
- Elimina a perda silenciosa da escolha do usuário entre sessões.

