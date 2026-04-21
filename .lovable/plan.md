

## Pré-visualização do system prompt consolidado no wizard rápido

Adiciono uma seção "Prévia do prompt consolidado" no **passo 4 (Prompt)** do wizard rápido — o último passo antes de salvar. Ela mostra exatamente o texto que será enviado ao LLM, com **variáveis interpoladas**, **markdown renderizado**, **contagem de tokens estimada** e botão de **copiar**.

### O que é "consolidado"

O prompt salvo hoje é apenas o texto bruto do usuário. A prévia mostra a versão final que vai para o LLM, somando:

1. **Cabeçalho de identidade automático** (`# 💬 Aurora` + missão como blockquote) — só adicionado se o prompt do usuário ainda não menciona o nome do agente.
2. **Variáveis interpoladas**: `{{name}}`, `{{agent_name}}`, `{{mission}}`, `{{description}}`, `{{type}}` / `{{persona}}`, `{{model}}`, `{{emoji}}` / `{{avatar}}`, `{{date}}` / `{{today}}`, `{{datetime}}`. Variáveis sem valor ficam literais e são sinalizadas em âmbar.
3. **Linha de meta** ao final: `<!-- meta: tipo=... · modelo=... · data=... -->`.

### Visão final no passo Prompt

```text
[ Editor de prompt existente ]

╭─ ✨ Prévia do prompt consolidado          ~847 tokens  ▼ ─╮
│                                                            │
│  [ Renderizado | Texto bruto ]      [ Copiar prompt final ]│
│                                                            │
│  Variáveis: ✓{{name}}  ✓{{mission}}  ⚠{{customer_id}}      │
│  ⚠ 1 variável sem valor permanecerá literal no prompt.    │
│                                                            │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ # 💬 Aurora                                          │  │
│  │ > Atender usuários com clareza e empatia            │  │
│  │                                                       │  │
│  │ ## Persona                                           │  │
│  │ • Tom profissional, gentil e direto                  │  │
│  │ • Responde em português brasileiro                   │  │
│  │ ...                                                  │  │
│  │ <!-- meta: tipo=chatbot · modelo=gpt-4o · data=… --> │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                            │
│  3.241 chars · 482 palavras · 47 linhas · ~847 tokens     │
╰────────────────────────────────────────────────────────────╯
```

A seção começa **fechada por padrão** (chevron expand) para não empurrar o editor; abre com animação `animate-page-enter`.

### Arquivos a criar

- **`src/lib/promptCompiler.ts`** — função pura `compilePrompt(input)` que:
  - Substitui as variáveis suportadas (regex `\{\{\s*key\s*\}\}`, case-insensitive).
  - Acrescenta cabeçalho de identidade quando o nome não aparece.
  - Acrescenta a linha `<!-- meta -->`.
  - Retorna `{ text, detectedVariables, unresolvedVariables, stats: { chars, words, lines, estimatedTokens } }` (tokens ≈ chars/4).

- **`src/components/agents/wizard/quickSteps/CompiledPromptPreview.tsx`** — componente colapsável com:
  - Toggle **Renderizado** (markdown leve: `#/##/###`, `**bold**`, listas `-`, blockquote `>`, `code`, e badges destacados para `{{var}}`) vs. **Texto bruto** (pre-formatado).
  - Botão **Copiar prompt final** com feedback de check.
  - Chips de variáveis: verde (✓ resolvida) ou âmbar (⚠ literal).
  - Aviso quando há variáveis não resolvidas.
  - Footer com chars / palavras / linhas / tokens estimados.
  - Container com `max-h-[420px] overflow-auto` e `aria-live="polite"`.

### Arquivos a alterar

- **`src/components/agents/wizard/quickSteps/StepQuickPrompt.tsx`** — importar `CompiledPromptPreview` e renderizá-lo logo após o card de pré-visualização do agente (no fim do step), passando `form`. A "Pré-visualização" atual (avatar + nome + meta) é mantida, complementada pela nova prévia consolidada.

### Detalhes técnicos

- **Sem dependência nova** — renderer markdown é um helper interno enxuto (sem `react-markdown`) cobrindo só o subset usado nos templates.
- **Sanitização**: o helper escapa `<`, `>`, `&` antes de aplicar regex de inline formatting; `dangerouslySetInnerHTML` recebe somente HTML construído por nós.
- **Performance**: `compilePrompt` é envolto em `useMemo` por `form`. Recalculo é O(n) sobre o texto do prompt — irrelevante para até 8.000 chars.
- **Persistência**: zero impacto. O `system_prompt` salvo no `agents.config` continua sendo o texto **bruto** digitado (`form.prompt`); o cabeçalho/meta são apenas visuais. Justificativa: manter o prompt editável depois sem efeitos colaterais; a interpolação real fica como responsabilidade do runtime/edge function.
- **Acessibilidade**: botão de toggle com `aria-expanded`, container com `aria-live="polite"`, foco visível nos toggles.
- **Design tokens**: `--primary` (acento principal), `--nexus-emerald` (variáveis OK), `--nexus-amber` (variáveis literais), `--secondary` (fundo do código), sem cores hard-coded.

### Impacto

- Zero migrações, zero edge functions, zero rotas novas.
- Toda a UX do passo 4 ganha clareza pré-save sem alterar o fluxo de validação ou o payload final.
- Base reutilizável: `compilePrompt` pode ser usado depois pelo modo "Avançado", playground e versionamento para gerar previews idênticos.

