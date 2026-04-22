

## Pré-visualização do prompt consolidado responsiva à variação

Hoje `CompiledPromptPreview` já recompila o prompt em tempo real (`useMemo([form])`) e mostra tokens, variáveis ✓/⚠ e stats — **mas só quando expandida**. Quando o usuário aplica uma variação (Conciso, Detalhado, etc.), o card fica colapsado e nada sinaliza que o conteúdo mudou. Resultado: parece que a prévia "não atualiza".

A mudança expõe os sinais relevantes **no header colapsado** e adiciona um destaque visual transitório quando o prompt muda.

### O que muda na visão do usuário

1. **Header colapsado mais informativo**:
   - Hoje: badge `~1.234 tokens` + chevron.
   - Depois: badge tokens + mini-pílula `✓ 3` (variáveis resolvidas) + `⚠ 1` (não resolvidas, em âmbar) + delta `+45 tokens` em verde/vermelho quando o último recompile mudou o total.
2. **Pulse de atualização**: ao aplicar uma variação (ou qualquer mudança que altere `compiled.text`), o card pulsa rapidamente (anel `ring-primary/40` por 600ms) e os tokens animam o delta.
3. **Auto-expandir uma vez na aplicação de variação**: quando o `prompt` muda por uma aplicação de variante (props nova `lastChangeKind: 'variant' | 'manual' | null`), o card abre se estava fechado, para o usuário ver imediatamente o resultado. Para edição manual contínua não auto-expande (evita pular durante digitação).
4. **Badge de variação ativa** dentro do header expandido: `Aplicado: Conciso` ou `Customizado` ao lado dos toggles `Renderizado / Texto bruto`, espelhando o que o checklist já mostra.

### Como funciona (técnico)

**`CompiledPromptPreview.tsx`**:
- Nova prop opcional `lastChangeKind?: 'variant' | 'manual' | null` e `activeVariantLabel?: string | null`.
- `useRef<number>(prevTokens)` + `useEffect([compiled.stats.estimatedTokens])` para calcular `tokenDelta` e disparar `setPulse(true)` por 600ms via `setTimeout`.
- `useEffect([lastChangeKind])`: quando vira `'variant'`, `setOpen(true)` se `!open`.
- Header colapsado renderiza `tokenDelta` (+/−) com cor semântica e contagens `compiled.detectedVariables.length - unresolvedVariables.length` ✓ e `unresolvedVariables.length` ⚠ como pílulas pequenas.
- Header expandido ganha pílula `Aplicado: {activeVariantLabel}` ao lado do switch `Renderizado/Texto bruto`.

**`StepQuickPrompt.tsx`**:
- Manter um `useState<'variant' | 'manual' | null>(lastChangeKind)`:
  - `onApplyVariant` (no callback do wrapper local) → `setLastChangeKind('variant')`.
  - `onPromptManualEdit` → `setLastChangeKind('manual')`.
- Passar `lastChangeKind` e `activeVariantLabel` para `<CompiledPromptPreview ... />`.
- Resetar para `null` após 800ms via `useEffect` para não reanimar em re-renders subsequentes.

Sem mudança em `promptCompiler.ts` — a recompilação já é determinística e instantânea.

### Casos cobertos

| Cenário | Comportamento |
|---|---|
| Aplico "Conciso" estando colapsado | Card auto-expande, anel pulsa, delta `−180 tokens` em vermelho aparece no header. |
| Edito 1 caractere | Sem auto-expand; se aberto, pulse leve + delta `+1 token` (não distrai). |
| Aplico variação idêntica (no-op) | Sem pulse, sem delta — `compiled.stats.estimatedTokens` não mudou. |
| Variável `{{name}}` agora resolvida após preencher Identidade | Pílula `✓` incrementa, `⚠` decrementa em tempo real. |
| Volto ao step do prompt | Card abre por `defaultOpen` como hoje; `lastChangeKind=null` evita pulse falso. |

### Arquivos tocados

- **Editar** `src/components/agents/wizard/quickSteps/CompiledPromptPreview.tsx` — props `lastChangeKind` / `activeVariantLabel`, lógica de pulse + delta, pílulas no header colapsado, badge de variação no expandido.
- **Editar** `src/components/agents/wizard/quickSteps/StepQuickPrompt.tsx` — rastrear `lastChangeKind` em torno de `onApplyVariant` / `onPromptManualEdit` e propagar `activeVariantLabel`.

### Impacto

- Zero schema/backend.
- Zero quebra: props novas opcionais; comportamento default é o atual.
- Resolve a percepção de "preview parado" — agora o feedback de tokens/variáveis é visível **antes** de expandir o card.

