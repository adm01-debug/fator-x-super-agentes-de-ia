

## Tela de Versionamento do Agente

Crio uma página dedicada `/agents/:id/versions` para gerenciar versões do agente — prompt do sistema + ferramentas — com **changelog automático** (diff estrutural gerado na hora de salvar) e **comparação visual lado a lado** entre quaisquer duas versões.

### Visão final da tela

```text
PageHeader: "Versionamento — {agente}"  [← Detalhes]  [+ Nova versão]

┌─ Coluna esquerda (timeline, 1/3) ──────────────────────────┐
│ ● v7  ATUAL    "Refinei tom + adicionei web_search"        │
│ │      hoje · 14:32 · 3 mudanças                            │
│ ○ v6           "Aumentei temperature para criatividade"     │
│ │      ontem · 09:10 · 1 mudança                            │
│ ○ v5           "Versão inicial publicada"                   │
│        12/04 · 16:20 · 5 mudanças                           │
│ ...                                                         │
│ [Selecionar A] [Selecionar B] para comparar                 │
└─────────────────────────────────────────────────────────────┘

┌─ Coluna direita (detalhe / comparação, 2/3) ───────────────┐
│ Modo: [Detalhe v7] [Comparar v6 ↔ v7]                       │
│                                                              │
│ DETALHE:                                                     │
│ ▸ Resumo: "Refinei tom + adicionei web_search"              │
│ ▸ Modelo: gpt-5-mini · Persona: specialist · Temp: 0.7      │
│ ▸ System Prompt (collapsible, syntax highlight)             │
│ ▸ Ferramentas (3): web_search ✓ · calculator ✓ · code ✓     │
│ ▸ Guardrails (2): pii_filter ✓ · cost_cap ✓                 │
│ [Restaurar esta versão] [Duplicar como rascunho]            │
│                                                              │
│ COMPARAÇÃO (split):                                          │
│ ┌─ Changelog automático ────────────────────────────────┐  │
│ │ + Adicionada ferramenta: web_search                    │  │
│ │ ~ Modelo: gpt-5-nano → gpt-5-mini                      │  │
│ │ ~ Temperature: 0.3 → 0.7                               │  │
│ │ ± System prompt: 412 → 587 chars (+42%)                │  │
│ └────────────────────────────────────────────────────────┘  │
│ ┌─ Diff do prompt (lado a lado, word-level) ────────────┐  │
│ │ v6 (vermelho)            │ v7 (verde)                  │  │
│ └────────────────────────────────────────────────────────┘  │
│ ┌─ Diff de ferramentas (tabela) ────────────────────────┐  │
│ │ Tool             │ v6   │ v7   │ Mudança             │  │
│ │ web_search       │  —   │  ✓   │ + adicionada        │  │
│ │ calculator       │  ✓   │  ✓   │  =                  │  │
│ └────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Diálogo "Nova versão"

Modal com:
- **Editor de prompt** (Textarea grande, mono, contador de chars)
- **Seleção de ferramentas ativas** (checkboxes a partir das `tools` da versão atual)
- **Modelo + temperature + max_tokens** (campos pré-preenchidos da versão atual)
- **Resumo da mudança** (Input — opcional; se vazio, gera automaticamente do diff)
- Preview do **changelog automático** já calculado antes de salvar
- Botão "Salvar como v{N+1}"

### Changelog automático (algoritmo)

Função `generateChangelog(prev, next)` compara dois `agent_versions` e produz uma lista tipada:

| Tipo | Quando | Exemplo |
|------|--------|---------|
| `added` | tool/guardrail novo, ou campo antes nulo | `+ Tool: web_search` |
| `removed` | tool/guardrail desativado | `- Tool: code_exec` |
| `modified` | mudança de valor escalar | `~ Modelo: gpt-5-nano → gpt-5-mini` |
| `prompt_changed` | system_prompt alterado | `± Prompt: 412 → 587 chars (+42%)` |

Se o usuário não escrever resumo, persisto o changelog renderizado em uma única linha como `change_summary`.

### Diff visual

- **Prompt**: `diffWords` da lib `diff` (já presente — vide `ArticleDiffViewer.tsx`), renderizado em duas colunas com highlight semântico (`bg-destructive/20` removido, `bg-nexus-emerald/20` adicionado)
- **Ferramentas/guardrails**: tabela com colunas v_A / v_B / status (badge com ícone)
- **Campos escalares**: lista de chips `chave: antigo → novo` (reaproveita lógica de `VersionDiffDialog.computeDeltas`)

### Arquivos a criar

- `src/lib/agentChangelog.ts` — `generateChangelog(prev, next)`, `summarizeChangelog(entries)`, tipos `ChangelogEntry`
- `src/components/agents/versioning/VersionTimeline.tsx` — coluna esquerda com lista de versões e seleção A/B
- `src/components/agents/versioning/VersionDetailPanel.tsx` — modo detalhe (prompt + tools + ações restaurar/duplicar)
- `src/components/agents/versioning/VersionComparePanel.tsx` — modo comparação (changelog + diff prompt + diff tools)
- `src/components/agents/versioning/NewVersionDialog.tsx` — modal de criação com preview do changelog
- `src/pages/AgentVersioningPage.tsx` — página orquestradora

### Arquivos a alterar

- `src/App.tsx` — adicionar rota `/agents/:id/versions` apontando para `AgentVersioningPage`
- `src/pages/AgentDetailPage.tsx` — no card "Histórico de Versões", trocar botão "Comparar" por "Gerenciar versões" que navega para `/agents/:id/versions` (mantém o diálogo de comparação rápido como fallback)
- `src/services/agentsService.ts` — adicionar `createAgentVersion({agentId, model, persona, mission, config, change_summary})` e `restoreAgentVersion(agentId, version)` (atualiza a tabela `agents` com os campos da versão escolhida)

### Detalhes técnicos

- **Sem migração de banco**: `agent_versions.config` (jsonb) já guarda `system_prompt`, `tools[]`, `guardrails[]`, `temperature`, `max_tokens` — campos hoje populados pelo wizard
- **Numeração**: `next_version = max(version) + 1`, garantida pelo unique constraint `(agent_id, version)`
- **Restaurar**: cria uma **nova versão** (v{N+1}) copiando os campos da versão escolhida com `change_summary = "Restaurado de v{X}"` — preserva auditoria, nunca sobrescreve histórico
- **Duplicar como rascunho**: copia config para o `agentBuilderStore` e navega para `/builder/:id` (sem persistir até o usuário salvar)
- **Reaproveitamentos**: `diffWords` (já em uso), `useAgentVersions` (hook existente), `PromptDiff`/`ArticleDiffViewer` (componentes já validados), `nexus-card`, `StatusBadge`, tokens semânticos
- **Estado**: `useState` para `selectedAId`/`selectedBId`/`mode` na página; React Query para fetch (`['agent-versions', id]`) com invalidação após criar/restaurar
- **Acessibilidade**: timeline navegável por teclado (setas ↑/↓), ARIA labels nos botões de seleção A/B, foco visível
- **Empty states**: se só houver 1 versão, modo comparação fica desabilitado com hint "Crie uma segunda versão para comparar"
- **Sem mudanças** em rotas existentes, schema, ou outras páginas além das duas listadas

