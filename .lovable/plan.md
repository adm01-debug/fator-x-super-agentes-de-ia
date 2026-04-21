

## Validações de seções obrigatórias no prompt do wizard rápido

Adiciono validação estrutural ao prompt do wizard rápido: ele só passa para "criar" quando contiver as 4 seções obrigatórias — **Persona, Escopo, Formato e Regras** —, com checklist visual ao vivo no editor e bloqueio de envio quando faltar alguma.

### Visão final no passo Prompt

```text
[ Editor de prompt ]

┌─ Checklist do prompt ─────────────────────── 2/4 ✓ ──┐
│ ✓ Persona      detectada em "## Persona"             │
│ ✓ Escopo       detectada em "## Escopo"              │
│ ✗ Formato      adicione "## Formato" — [+ Inserir]   │
│ ✗ Regras       adicione "## Regras"  — [+ Inserir]   │
│                                                       │
│ ⚠ Faltam 2 seções. Inclua-as antes de criar.         │
└──────────────────────────────────────────────────────┘
```

Cada item faltante traz um botão **+ Inserir**: anexa um esqueleto da seção ao final do prompt (`\n\n## Formato\n- ...`) para o usuário preencher.

### Detecção (case-insensitive, sem acento)

Procura headings markdown (`#`, `##`, `###`) cujo título contém alguma das aliases:

| Seção    | Aliases reconhecidas                                                |
| -------- | ------------------------------------------------------------------- |
| Persona  | persona, identidade, role, "você é"                                 |
| Escopo   | escopo, scope, objetivo, responsabilidades                          |
| Formato  | formato, format, estilo, tom, output                                |
| Regras   | regras, rules, restrições, constraints, guardrails, nunca, sempre   |

### Mudanças

**`src/lib/validations/quickAgentSchema.ts`**:
- Exportar `REQUIRED_PROMPT_SECTIONS`, `PromptSectionKey`, `detectPromptSections(prompt)`, `getMissingSections(prompt)`.
- Estender `quickPromptSchema` com `.superRefine()` que falha quando faltarem seções, com mensagem listando o que falta.

**`src/components/agents/wizard/quickSteps/PromptSectionChecklist.tsx`** (novo):
- Recebe `prompt` e `onInsert(snippet)`.
- Renderiza 4 linhas com ícone (`CheckCircle2` verde / `XCircle` muted), label e botão **+ Inserir** quando faltar.
- Cabeçalho com contador `N/4 ✓` e bordas semânticas (`border-nexus-emerald/30` quando completo, `border-nexus-amber/40` quando parcial).
- `aria-live="polite"` para anunciar mudanças de status.

**`src/components/agents/wizard/quickSteps/StepQuickPrompt.tsx`**:
- Importar e renderizar `PromptSectionChecklist` entre o editor e a pré-visualização.
- `onInsert(snippet)` → `update('prompt', form.prompt + snippet)`.
- Snippets pré-prontos por seção (ex.: `\n\n## Formato\n- Máximo 200 palavras\n- Use listas curtas\n`).

**`src/data/quickAgentTemplates.ts`**:
- Auditar os 7 templates e garantir `## Regras` em todos (alguns só têm Persona/Escopo/Formato), para que "Restaurar template" sempre produza um prompt válido.

### Comportamento de bloqueio

- Botão **Criar agente** já chama `validateStep(3)` antes de salvar; com o schema estendido, ele falha com a mensagem explicando o que falta.
- O erro inline existente abaixo do textarea continua mostrando a mensagem do schema (agora mais descritiva).
- O checklist é o feedback principal — o usuário vê em tempo real o que falta.

### Detalhes técnicos

- Sem dependência nova, sem migração, sem rotas.
- Detecção é O(n) sobre as linhas — barato a cada keystroke.
- `stripAccents` via `normalize('NFD')` para casar "restrições" e "restricoes".
- Backward-compatible: prompts já salvos no banco não são afetados (validação só roda no wizard).
- Acessibilidade: itens do checklist com `role="status"`, botões "+ Inserir" com `aria-label` descritivo.

### Impacto

- Usuário ganha feedback claro sobre a estrutura mínima de um bom system prompt.
- Templates continuam funcionando após a auditoria de "Regras".
- Zero impacto nos modos "Avançado" ou "Template" do wizard maior.

