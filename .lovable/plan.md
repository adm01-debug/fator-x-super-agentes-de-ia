

## Seletor de variações de templates de prompt por tipo

Atualmente o passo 4 do wizard rápido tem só **um** prompt por tipo (via `QUICK_AGENT_TEMPLATES[type].systemPrompt`) e um botão "Restaurar template" que sobrescreve com essa única opção. Vou expandir para **3 variações por tipo** (estilos diferentes de prompt) com um seletor visual no topo do editor que aplica automaticamente ao clicar.

### Visão final no passo Prompt

```text
┌─ Variações de prompt para "Chatbot" ────────────────┐
│ [● Equilibrado]  [○ Conciso]  [○ Detalhado]         │
│   atual              curto         estendido         │
└──────────────────────────────────────────────────────┘

[ Editor de prompt — preenchido com a variação ativa ]

[ Checklist 4/4 ✓ ]
[ Pré-visualização do agente ]
[ Prompt consolidado ]
```

### Os 3 estilos (mesmos para todos os tipos)

| Estilo          | Tom                                              | Tamanho aproximado |
| --------------- | ------------------------------------------------ | ------------------ |
| **Equilibrado** | versão atual — sweet spot persona+regras+formato | ~600-900 chars     |
| **Conciso**     | enxuto, bullets curtos, mínimo viável            | ~300-450 chars     |
| **Detalhado**   | extensivo, com exemplos, anti-padrões e métricas | ~1.200-1.800 chars |

Todos passam no checklist (Persona/Escopo/Formato/Regras) e referem o `suggestedName` do tipo.

### Mudanças

**`src/data/quickAgentTemplates.ts`**:
- Adicionar tipo `PromptVariantId = 'balanced' | 'concise' | 'detailed'`.
- Adicionar interface `PromptVariant { id, label, description, prompt }`.
- Estender cada `QuickAgentTemplate` com `promptVariants: Record<PromptVariantId, PromptVariant>` (3 variações por tipo × 7 tipos = 21 prompts).
- Manter `systemPrompt` apontando para `promptVariants.balanced.prompt` (backward-compat com `applyTemplate` no QuickCreateWizard).
- Exportar constante `PROMPT_VARIANT_META: Record<PromptVariantId, { label, description, icon }>` para a UI.

**`src/components/agents/wizard/quickSteps/PromptVariantSelector.tsx`** (novo):
- Recebe `type: QuickAgentType`, `activeVariant: PromptVariantId`, `onSelect(id, prompt)`.
- 3 chips/cards horizontais (radio-like) com label, descrição curta e ícone (`Scale`, `Minus`, `Plus`).
- Cartão ativo: `ring-2 ring-primary bg-primary/10`; demais: `hover:bg-secondary/60`.
- Texto auxiliar: "Aplicar substitui o prompt atual."
- `aria-pressed` para acessibilidade; tab navegável.

**`src/components/agents/wizard/quickSteps/StepQuickPrompt.tsx`**:
- Adicionar prop opcional `onVariantApply?: (variantId, prompt) => void`.
- Estado local `activeVariant` (default `'balanced'`); detecção: se o prompt atual bate com alguma variação, marca como ativa; senão fica "custom" (nenhuma chip pintada).
- Renderizar `PromptVariantSelector` no topo, antes do textarea.
- Manter botão "Restaurar template" (continua restaurando a variação ativa).

**`src/components/agents/wizard/QuickCreateWizard.tsx`**:
- `applyTemplate` continua aplicando a variação `balanced` (default).
- Adicionar handler `applyPromptVariant(variantId)` que faz `update('prompt', variant.prompt)` + toast `Variação "{label}" aplicada`.
- Passar para `<StepQuickPrompt>` via prop.

### Detecção de variação ativa

Comparação simples: `prompt.trim() === variant.prompt.trim()` para cada variação do tipo atual. Se nenhuma bater → "Custom" (nenhum chip ativo, mas chips continuam clicáveis para sobrescrever). Evita que pequenas edições do usuário sejam perdidas silenciosamente — clicar numa chip mostra um `confirm` inline ("Substituir prompt atual?") só quando o prompt foi modificado em relação à variação detectada.

### UX e acessibilidade

- Chips com `role="radio"` dentro de `role="radiogroup"`, `aria-checked` no ativo.
- Toast Sonner ao trocar: `Variação "{label}" aplicada` com `description: "Você pode editar livremente depois."`.
- Sem cores hard-coded — tokens semânticos (`--primary`, `--secondary`, `--muted-foreground`).
- Mobile: chips quebram em 2 colunas abaixo de 480px.

### Impacto

- Zero migração, zero mudança de schema, zero impacto em outros wizards.
- Backward-compatible: `QUICK_AGENT_TEMPLATES[t].systemPrompt` continua existindo e aponta pra `balanced`.
- Usuário ganha 3× mais opções de partida sem precisar escrever do zero.
- Reusable: a estrutura `promptVariants` pode ser usada depois pelo modo Avançado e pelo playground.

