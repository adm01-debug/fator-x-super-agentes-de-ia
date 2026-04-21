

## Validação pré-save de versão (rascunho) com placeholders, limites e inconsistências

Adiciono uma camada de validação reutilizável que roda **antes** de salvar um rascunho de versão no `DraftVersionsDialog`. Ela detecta:

1. **Placeholders ausentes** no `system_prompt` (ex.: `{{name}}`, `{{mission}}`, `{{custom_var}}` que não resolvem).
2. **Tamanho mínimo/máximo** do prompt (reusa `PROMPT_LIMITS` já existente) e do **label/nota** do rascunho.
3. **Inconsistências de configuração** entre os módulos do agente.

### Visão final no dialog

```text
┌─ Salvar estado atual ─────────────────────── local ─┐
│ [ Título do rascunho ........................... ] │
│ [ Anotação opcional ............................ ] │
│                                                     │
│ ⚠ Validação antes de salvar         3 itens        │
│ ─────────────────────────────────────────────────── │
│ ✕ Erro    Prompt abaixo do mínimo (32/50 chars)    │
│ ✕ Erro    Placeholders não resolvidos: {{tone}},   │
│           {{customer_name}}                        │
│ ⚠ Aviso   RAG ativo mas nenhuma fonte cadastrada   │
│ ⚠ Aviso   Modelo "claude-opus" + 0 tools — caro    │
│           para baixa capacidade efetiva            │
│                                                     │
│ [ Salvar mesmo assim ]      [ Salvar rascunho ▸ ]  │
└─────────────────────────────────────────────────────┘
```

- **Erros bloqueiam** o botão principal "Salvar rascunho" por padrão.
- Botão secundário **"Salvar mesmo assim"** aparece só quando há erros e permite override consciente (snapshot continua sendo só local).
- Avisos nunca bloqueiam — apenas alertam.

### Componentes / mudanças

**1. Novo `src/lib/validations/agentVersionValidator.ts`** (puro, sem dependências de UI):
```ts
export interface VersionValidationIssue {
  level: 'error' | 'warning';
  code: string;          // 'prompt.too_short' | 'prompt.unresolved_vars' | 'config.rag_no_sources' | ...
  field?: string;        // 'label' | 'note' | 'system_prompt' | 'rag' | 'tools' | 'model'
  message: string;       // PT-BR
}
export interface VersionValidationResult {
  errors: VersionValidationIssue[];
  warnings: VersionValidationIssue[];
  canSave: boolean;      // === errors.length === 0
}
export function validateAgentVersion(
  agent: AgentConfig,
  meta: { label: string; note?: string },
): VersionValidationResult
```

Regras implementadas:
- **Label**: `trim` 3–80 chars; obrigatório se usuário digitou algo (vazio = ok, usa auto-label).
- **Nota**: máx 500 chars.
- **Prompt mínimo/máximo**: reusa `analyzePromptStructure` + `PROMPT_LIMITS` (`MIN_TOTAL`, `MAX_TOTAL`, `MAX_LINES`). `belowMin` e `exceedsCharLimit` viram **erro**, `consecutiveEmptyBlocks` vira **aviso**.
- **Placeholders ausentes**: chama `compilePrompt({...})` (já existe em `src/lib/promptCompiler.ts`) com os campos atuais do agente; o array `unresolvedVariables` retornado vira erro `prompt.unresolved_vars` listando as variáveis (ex.: `{{tone}}, {{customer_name}}`).
- **Inconsistências de configuração** (todos warnings):
  - `rag_sources.length === 0` mas `rag_architecture` ≠ `none` → "RAG ativo sem fontes".
  - Nenhum tool habilitado mas `reasoning === 'react'` → "ReAct sem tools disponíveis".
  - Modelo caro (`claude-opus-4.6` ou `gpt-4o`) com 0 tools e prompt < 200 chars → "Modelo caro para uso simples".
  - Nenhum guardrail ativo + `status === 'production'` → "Produção sem guardrails".
  - `memory_episodic` ou `memory_semantic` ativos mas nenhuma `memory_*` curto-prazo → "Memória de longo prazo sem curto prazo".
  - `system_prompt` não menciona `{{name}}` nem o nome literal do agente → "Prompt não referencia identidade do agente".

**2. Novo `src/components/agent-builder/VersionValidationPanel.tsx`**:
- Recebe `result: VersionValidationResult`.
- Renderiza header com contagem `N erros, M avisos` e ícones (`ShieldAlert` / `AlertTriangle`).
- Lista compacta com cor por nível (token semântico `--destructive` / `--nexus-amber`), texto da regra e código pequeno em `font-mono` (ex.: `prompt.unresolved_vars`).
- Quando vazio: card discreto verde "Validações OK" (`--nexus-emerald`), sem ocupar espaço excessivo.
- Acessível: `role="alert"` para erros, `role="status"` para avisos.

**3. Editar `src/components/agent-builder/DraftVersionsDialog.tsx`**:
- Importar `validateAgentVersion` + `VersionValidationPanel`.
- Calcular `validation` via `useMemo` dependente de `[agent, label, note]`.
- Renderizar `<VersionValidationPanel result={validation} />` entre o textarea e os botões.
- Estado local `forceSave: boolean` (reset toda vez que o dialog abre).
- Botão "Salvar rascunho" `disabled={!validation.canSave && !forceSave}`.
- Quando `errors.length > 0`, mostrar botão secundário ghost "Salvar mesmo assim" que faz `setForceSave(true)` e dispara o save no clique seguinte (ou direto, com `toast` de aviso).
- `handleSave` permanece chamando `saveDraftVersion` (sem mudança de assinatura), mas só roda quando habilitado.

### Detalhes técnicos

- **Sem alteração de schema, sem backend**, sem mudança em `agentDraftVersionsService` (a validação fica fora — separação clara entre regra e armazenamento).
- **Reuso máximo**: `analyzePromptStructure`, `PROMPT_LIMITS`, `compilePrompt` já existentes.
- **Tokens semânticos**: `--destructive`, `--nexus-amber`, `--nexus-emerald`, `--muted-foreground`. Zero cor hard-coded.
- **i18n**: mensagens PT-BR diretas (alinhadas ao padrão atual de `getPromptIssues`).
- **Testabilidade**: validador é função pura → fácil de cobrir com vitest no futuro (`src/test/agent-version-validator.test.ts`, opcional, fora do escopo desta entrega).
- **Reusabilidade**: a função `validateAgentVersion` poderá ser plugada também no `savePromptVersion` do store e no fluxo "Criar versão real" (botão Salvar do builder) em um próximo passo, sem refator.

### Arquivos

- **Criar**: `src/lib/validations/agentVersionValidator.ts`
- **Criar**: `src/components/agent-builder/VersionValidationPanel.tsx`
- **Editar**: `src/components/agent-builder/DraftVersionsDialog.tsx` — integrar painel, bloquear save com erros, opção de override.

### Impacto

- Usuário recebe feedback claro **antes** de salvar versão sobre prompt incompleto, variáveis não resolvidas e configuração suspeita do agente.
- Reduz rascunhos "lixo" (vazios, com placeholders crus, inconsistentes) sem impedir flexibilidade (override consciente).
- Base reutilizável para validar futuros saves reais (versão persistida no backend).

