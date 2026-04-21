

## Recuperação automática do rascunho do wizard rápido

Hoje o `QuickCreateWizard` já lê `localStorage['quick-agent-wizard-draft']` silenciosamente no mount — o usuário não percebe que foi restaurado e não consegue descartar. Vou tornar essa recuperação **explícita, visível e controlável**, restaurando identidade, tipo, modelo e prompt com confirmação clara.

### Comportamento final

1. Ao entrar em **Criação rápida** com um rascunho salvo (≤ 7 dias), o formulário **não preenche automaticamente**. Em vez disso, abre um banner no topo:

```text
┌─ 📝 Rascunho encontrado ───────────────────────────────┐
│ Você começou um agente "Atlas Suporte" há 2 horas.    │
│ Identidade ✓ · Tipo ✓ · Modelo ✓ · Prompt parcial     │
│                                                        │
│             [Descartar]  [Continuar de onde parei →]  │
└────────────────────────────────────────────────────────┘
```

2. **Continuar** → restaura `name`, `emoji`, `mission`, `description`, `type`, `model`, `prompt`, pula o usuário para o **primeiro passo com campo incompleto** e mostra toast `"Rascunho restaurado"`.
3. **Descartar** → limpa o `localStorage`, mantém `QUICK_AGENT_DEFAULTS` e o banner some.
4. Após o agente ser criado com sucesso, o draft é limpo (já acontece). Se o usuário sair no meio (unmount), o autosave continua salvando a cada keystroke (já acontece) com um carimbo `savedAt`.
5. Drafts com mais de **7 dias** são tratados como expirados e descartados silenciosamente.

### Mudanças técnicas

**`src/lib/validations/quickAgentSchema.ts`** — exportar helper `isDraftMeaningful(form)` que retorna `true` se qualquer campo difere de `QUICK_AGENT_DEFAULTS` (evita mostrar banner para rascunho vazio).

**`src/components/agents/wizard/QuickCreateWizard.tsx`**:
- Mudar formato persistido para `{ form, savedAt: ISOString }` (com migração transparente: se ler o formato antigo, embrulha com `savedAt = now`).
- Trocar a inicialização silenciosa: `useState(QUICK_AGENT_DEFAULTS)` + novo state `pendingDraft: { form, savedAt } | null` lido do localStorage no mount via `useEffect`.
- Validar idade (`now - savedAt < 7 dias`) e relevância (`isDraftMeaningful`); se falhar, descarta.
- Calcular passo de retomada: primeiro `STEPS[i]` cujo `schema.safeParse(draft.form)` falha; default = 0.

**`src/components/agents/wizard/DraftRecoveryBanner.tsx`** (novo):
- Props: `savedAt: string`, `summary: { name, type, model, hasPrompt }`, `onRestore()`, `onDiscard()`.
- Renderiza card com `nexus-card`, ícone `FileClock`, tempo relativo em PT-BR (`há 2 horas` via util simples inline), 4 chips de status (Identidade/Tipo/Modelo/Prompt: ✓ preenchido, — vazio), e dois botões. Animação `animate-page-enter`.
- Acessível: `role="status"`, `aria-live="polite"`, foco inicial no botão "Continuar".

### Detalhes UX

- O banner aparece **acima do header de passos**, dentro do mesmo container `max-w-[1100px]`.
- Tempo relativo: `agora`, `há X minutos`, `há X horas`, `há X dias` (cap em 7).
- Resumo dos 4 campos: ícone `Check` verde se preenchido, `Minus` muted se vazio.
- Toast Sonner ao restaurar: título `"Rascunho restaurado"`, descrição `"Continuando do passo: {label}"`.
- Toast Sonner ao descartar: `"Rascunho descartado"`.

### Impacto

- Zero mudanças em rotas, schema do banco, ou outros wizards (template/scratch).
- Comportamento de autosave inalterado — só muda **como o draft é apresentado** ao retornar.
- Backward-compatible com drafts existentes no localStorage.

