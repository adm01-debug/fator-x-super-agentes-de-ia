

## Diff visual ao alternar entre variações de prompt

Hoje o `applyPromptVariant` se comporta assim:
- Se o prompt está **custom-locked** (usuário editou) → abre `AlertDialog` "Substituir prompt customizado?" com só contagem de chars, **sem mostrar o que muda**.
- Se **não está locked** → aplica direto, sem confirmação, sobrescrevendo o texto atual (que pode ter pequenas edições dentro do lock-off, ou ser uma variação anterior diferente).

A mudança mostra um **diff lado a lado** (atual ↔ nova variação) **antes** da substituição, em ambos os casos quando há diferença real.

### O que muda na visão do usuário

1. Clico em **Conciso** estando em **Detalhado** → abre dialog "Trocar para Conciso?" com diff visual mostrando linhas removidas (vermelho, prefixo `−`) e linhas adicionadas (verde, prefixo `+`). Boto **Aplicar** confirma; **Cancelar** mantém o prompt atual.
2. Clico em **Conciso** estando em **custom-locked** → mesmo dialog, header destaca o lock (`"Você editou o prompt manualmente"`) + diff completo do texto atual contra a variação alvo.
3. Clico em **Conciso** estando **já em Conciso** sem nenhuma edição → não abre dialog (texto idêntico, no-op silencioso com toast "Já está usando Conciso").
4. Clico em **Conciso** estando em Conciso **com edições leves** → abre dialog mostrando o diff entre o texto editado e o template puro de Conciso, para o usuário decidir se quer descartar as edições.
5. Header do dialog mostra contagem agregada: `"12 linhas removidas, 8 adicionadas, 4 inalteradas"`.

### Como funciona (técnico)

**Reaproveitar `src/components/prompts/PromptDiff.tsx`** — já faz diff LCS por linhas com cores (`destructive` para removido, `nexus-emerald` para adicionado), labels customizáveis e scroll. Zero código novo de diff.

**Novo dialog `PromptVariantDiffDialog`** em `src/components/agents/wizard/quickSteps/PromptVariantDiffDialog.tsx`:
- Props: `open`, `onOpenChange`, `currentPrompt`, `currentLabel` (ex: `"Detalhado"` / `"Customizado"`), `nextPrompt`, `nextLabel` (ex: `"Conciso"`), `customLocked`, `onConfirm`.
- Layout: `AlertDialog` largo (`max-w-3xl`), header com título dinâmico + descrição contextual (lock vs. troca normal) + badge de stats (linhas +/−), corpo com `<PromptDiff textA={currentPrompt} textB={nextPrompt} labelA={currentLabel} labelB={nextLabel} />`, footer com Cancelar / Aplicar.
- Stats calculadas via mesma `diffLines` (export adicional do `PromptDiff` ou recálculo local com helper extraído).

**Alterar `applyPromptVariant` em `QuickCreateWizard.tsx`**:
```ts
const applyPromptVariant = (variantId: PromptVariantId) => {
  const t = QUICK_AGENT_TEMPLATES[form.type as QuickAgentType];
  const nextPrompt = t.promptVariants[variantId].prompt;
  // No-op se idêntico
  if (form.prompt.trim() === nextPrompt.trim()) {
    toast.info(`Já está usando "${t.promptVariants[variantId].label}"`);
    setSelectedVariant(variantId);
    setPromptCustomLocked(false);
    return;
  }
  // Sempre passa pelo dialog quando há diferença real
  setPendingVariant(variantId);
};
```

**Substituir o `AlertDialog` inline atual** (linhas 607-638) pelo novo `PromptVariantDiffDialog`, propagando:
- `currentPrompt={form.prompt}`
- `currentLabel` derivado do `selectedVariant` ou `"Customizado"` se locked / `"Atual"` como fallback
- `nextPrompt` / `nextLabel` resolvidos do `pendingVariant`
- `customLocked={promptCustomLocked}`
- `onConfirm={() => { doApplyPromptVariant(pendingVariant!); setPendingVariant(null); }}`

**Helper de stats** — pequeno utilitário no topo do `PromptVariantDiffDialog`:
```ts
function diffStats(a: string, b: string) {
  // contar linhas iguais/adicionadas/removidas via mesma LCS do PromptDiff
}
```
Para evitar duplicar a LCS, exportar `diffLines` de `PromptDiff.tsx` (named export) e importar no dialog para gerar o resumo.

### Casos cobertos

| Cenário | Comportamento |
|---|---|
| Troca Equilibrado → Conciso | Dialog com diff mostrando seções encurtadas. |
| Custom-locked → Detalhado | Dialog com badge "Você editou manualmente" + diff completo. |
| Mesmo template, sem edições | No-op silencioso, sem dialog. |
| Mesmo template, com edições | Dialog mostra diff entre edição e template puro. |
| Cancelar no dialog | Prompt e estado de lock/variant preservados. |
| Confirmar | `doApplyPromptVariant` roda como hoje (substitui, destrava lock, grava `selectedVariant`). |

### Arquivos tocados

- **Criar** `src/components/agents/wizard/quickSteps/PromptVariantDiffDialog.tsx` — novo dialog com diff, stats e confirmação.
- **Editar** `src/components/prompts/PromptDiff.tsx` — exportar `diffLines` como named export para o dialog calcular stats sem duplicar LCS.
- **Editar** `src/components/agents/wizard/QuickCreateWizard.tsx` — `applyPromptVariant` sempre dispara `pendingVariant` quando há diff (com early-return para no-op); substituir o `AlertDialog` inline pelo `PromptVariantDiffDialog`.

### Impacto

- Zero mudança de schema/backend.
- Zero quebra: o fluxo de confirmação para custom-locked continua funcionando (ganha diff visual em vez de só contagem de chars).
- Adiciona uma confirmação onde antes não havia (variante → variante), mas com no-op silencioso quando texto é idêntico — não vira fricção em cliques redundantes.
- Reaproveita componente `PromptDiff` já maduro do projeto (mesma UX visual de versionamento de agente).

