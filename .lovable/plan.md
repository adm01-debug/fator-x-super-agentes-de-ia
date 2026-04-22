

## Pré-visualização consolidada antes de criar o agente

Hoje o `CompiledPromptPreview` existe, mas:
- Fica **colapsado por padrão** no fim do passo Prompt, abaixo de Live Preview e Test Panel — fácil de não ver.
- O botão **Criar agente** dispara o save direto, sem checkpoint visual.

Vou entregar **ambos** os reforços (escolha do usuário): preview inline aberto + diálogo de confirmação ao clicar Criar.

### 1. Componente novo: `PreflightReviewSummary`

**Arquivo:** `src/components/agents/wizard/quickSteps/PreflightReviewSummary.tsx`

Card compacto que resume **identidade + tipo + modelo + cobertura de seções + variáveis não resolvidas**, pensado para ser denso e visual (não duplica o `CompiledPromptPreview`):

- Header: `🚀 Pronto para criar` + emoji/nome/tipo/modelo em uma linha.
- **Chips de seções obrigatórias** usando `detectPromptSections` + `REQUIRED_PROMPT_SECTIONS`: cada uma com check verde ou warning âmbar.
- **Chips de variáveis** (verdes resolvidas, âmbar não-resolvidas) reusando `compilePrompt`.
- **Stats inline**: chars, palavras, ~tokens.
- Aviso amarelo se houver variáveis não resolvidas ou seções faltando.
- Sem botão de copiar/expandir — é só um sumário; o `CompiledPromptPreview` logo abaixo serve para inspecionar o texto completo.

### 2. Ajuste em `StepQuickPrompt.tsx`

- Renderiza `PreflightReviewSummary` **acima** do `CompiledPromptPreview` (apenas no passo Prompt, que já é o último).
- Passa `defaultOpen={true}` para `CompiledPromptPreview` para que o texto compilado fique visível direto sem precisar clicar.
- Reordena: `AgentLivePreviewCard` → `PreflightReviewSummary` (novo) → `CompiledPromptPreview` (aberto) → `QuickAgentTestPanel`. Live preview fica antes porque foca em identidade visual; o preflight foca em "está tudo pronto?".

### 3. Diálogo de confirmação ao clicar **Criar agente** em `QuickCreateWizard.tsx`

- Estado novo: `const [confirmOpen, setConfirmOpen] = useState(false)`.
- Substituo o botão final por um trigger que:
  1. Roda `validateStep(i)` em todos os passos primeiro (mesma lógica de `saveAgent`); se algum falhar, vai pro passo errado e mostra toast — **não abre o diálogo**.
  2. Se tudo ok, abre `Dialog` (do `@/components/ui/dialog`) com:
     - Título: `Criar "${form.name}"?`
     - Resumo curto (emoji + nome + tipo + modelo).
     - **Chips de seções** + **chips de variáveis não resolvidas** (mesma fonte do `PreflightReviewSummary`, função compartilhada).
     - Stats: `~X tokens · Y linhas`.
     - Aviso âmbar se houver `unresolvedVariables` (`"N variável(eis) ficarão literais — confirme mesmo assim?"`) ou se faltar seção (defensivo, embora schema já bloqueie).
     - Footer: **Cancelar** (fecha) + **Criar agente** (dispara `saveAgent`).
  3. `saveAgent` perde a re-validação dupla (já feita antes de abrir) — passo `setConfirmOpen(false)` no início e mantém o resto.
- Atalho `Ctrl+Enter` no último passo agora abre o diálogo (em vez de salvar direto), preservando o checkpoint.

### 4. Helper compartilhado para evitar duplicação

Em `PreflightReviewSummary.tsx` exporto também `useReviewData(form)` (hook leve com `useMemo`) que retorna `{ sections, missingSections, compiled, hasUnresolved, hasMissingSections }`. O diálogo no wizard reusa esse hook → zero duplicação de lógica entre summary inline e modal.

### Comportamento

- Usuário no passo Prompt vê de cara: card "Pronto para criar" + prompt compilado expandido logo abaixo.
- Ao clicar **Criar agente** → diálogo modal de confirmação com mesmas informações resumidas. Pode cancelar (Esc, Cancel, fora do modal) ou confirmar.
- Validação só passa para o diálogo se tudo estiver correto — diálogo nunca aparece em estado inválido.
- `Ctrl+Enter` agora abre o diálogo, não salva direto (mais seguro).

### Arquivos

- **Criar:** `src/components/agents/wizard/quickSteps/PreflightReviewSummary.tsx`
- **Editar:** `src/components/agents/wizard/quickSteps/StepQuickPrompt.tsx` (renderiza summary + abre o `CompiledPromptPreview` por padrão)
- **Editar:** `src/components/agents/wizard/QuickCreateWizard.tsx` (estado do diálogo, novo handler `requestCreate` que valida-e-abre, atalho `Ctrl+Enter` redirecionado, JSX do `Dialog` no rodapé)

### Impacto

- Zero criação acidental — passa-se por modal explícito de confirmação.
- Usuário enxerga prompt final sem cliques extras.
- Reusa lógica existente (`compilePrompt`, `detectPromptSections`) — zero novo schema/backend.
- Nenhuma mudança em props públicas dos componentes existentes (`CompiledPromptPreview` já aceitava `defaultOpen`).

