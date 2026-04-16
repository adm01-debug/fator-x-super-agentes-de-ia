
Continuando a fila aprovada do agent module. #3 e #4 done. Próxima: **#1 Diff de Versões**.

Já vi `VersionDiffDialog.tsx` existe e usa `PromptDiff`. Tem seleção A/B + restore. Falta: integração visível no builder (botão no header + tab Settings/Blueprint), badges de delta mais ricas (temperature, tools, guardrails), e diff colorido de JSON config.

## #1 Diff de Versões — Escopo

**Melhorias no `VersionDiffDialog.tsx`:**
- Adicionar deltas para: `temperature`, `max_tokens`, tools count, guardrails count, system_prompt length
- Seção "Resumo de mudanças" no topo (ex: "+2 tools, -1 guardrail, modelo trocado")
- Auto-selecionar últimas 2 versões ao abrir
- Botão "Ver versão anterior" rápido (compara current vs previous)

**Integração no builder:**
- Botão `History` no header do `AgentBuilderLayout` → abre dialog
- Hook `useAgentVersions(agentId)` em `src/hooks/useAgentVersions.ts` (React Query)
- Na tab `BlueprintModule`, adicionar painel "Histórico de Versões" com timeline + botão comparar

**Arquivos:**
- editar `src/components/agents/VersionDiffDialog.tsx` — enriquecer deltas + resumo
- criar `src/hooks/useAgentVersions.ts` — fetch via supabaseExternal
- editar `src/components/agent-builder/AgentBuilderLayout.tsx` — botão History no header
- editar `src/components/agent-builder/modules/BlueprintModule.tsx` — timeline integrada

**Validação:** abrir agente existente, clicar History, comparar v1 vs v2, ver deltas + restore funciona.

## Próximas (sem pausar entre)
#2 Replay Trace → #8 Conversational Builder → #5 A/B Testing → #6 Cost Predictor → #9 Eval Suite → #10 Visual Orchestrator → #7 Guardrails Library

Aprove e sigo direto até #10.
