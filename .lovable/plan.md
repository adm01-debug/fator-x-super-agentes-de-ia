

## Medidor de uso por seção (Persona, Escopo, Formato, Regras)

Hoje o checklist mostra apenas **palavras** por seção e o limite global do prompt aparece só no rodapé do editor. Não há visibilidade de **quanto cada seção pesa** no orçamento total — o usuário descobre que está perto do teto sem saber qual seção cortar.

### O que muda na visão do usuário

Novo cartão **"Uso por seção"** entre o `PromptSectionChecklist` e o `PromptHistoryPanel`, com 4 linhas (Persona, Escopo, Formato, Regras):

1. **Stats numéricas** por seção: `chars · linhas · palavras · ~tokens`.
2. **Barra de progresso horizontal** mostrando o % do **limite total** (`PROMPT_LIMITS.MAX_TOTAL`) que aquela seção ocupa. Cor escala: verde (<20%), amber (20–35%), vermelho (>35%).
3. **Badge "🔥 Maior contribuinte"** na seção que mais consome chars (apenas se `chars > 0`).
4. **Linha de "Outros"** ao final: chars que estão **fora** das 4 seções canônicas (header/identidade, comentários, espaço entre blocos) — útil para identificar gordura não atribuída.
5. **Footer compacto**: `total: 4.230 / 8.000 chars (53%) · 4 seções somam 89%` — dá o panorama em uma linha.
6. **Estado vazio por seção**: se `status === 'missing'`, mostra `— ausente` em cinza (sem barra), em vez de zeros confusos.
7. **Click na linha** → reaproveita `onJumpToSection` para pular o cursor pra aquela seção no editor (fluxo já existente, sem código novo no parent).

### Como funciona (técnico)

**Novo arquivo** `src/components/agents/wizard/quickSteps/PromptSectionUsage.tsx`:

- Props: `{ prompt: string; onJumpToSection?: (key: PromptSectionKey) => void }`.
- `useMemo([prompt])` para calcular, via `locateSections(prompt)` (já existente):
  - Para cada `SectionLocation` com `status !== 'missing'`: extrai `prompt.slice(startChar, endChar)` → conta `chars`, `lines` (split `\n`), `words`, `estimatedTokens` (`Math.ceil(chars/4)`, mesma heurística do `promptCompiler`).
  - Calcula `othersChars = totalChars - sum(sectionChars)`.
  - `topKey` = chave com maior `chars` entre as presentes.
- Renderização: `<ul>` com 4 `<li>` (canonical order) + linha "Outros". Cada item tem:
  - Ícone do status (✓ ok / ⚠ thin / ○ missing) — reaproveita ícones do checklist para coerência visual.
  - Label + stats em `font-mono text-[10px]`.
  - Barra: `<div className="h-1.5 rounded bg-secondary"><div style={{width: pct%}} className={toneClass}/></div>`.
  - Badge "🔥 Maior" se `key === topKey`.
- Tones via classes Tailwind semânticas (`bg-nexus-emerald`, `bg-nexus-amber`, `bg-destructive`) — sem cores cruas.

**Editar** `src/components/agents/wizard/quickSteps/StepQuickPrompt.tsx`:

- Importar `PromptSectionUsage` e renderizar após o `PromptSectionChecklist` (linha ~330), passando `prompt={form.prompt}` e `onJumpToSection={jumpToSection}`.

### Casos cobertos

| Cenário | Comportamento |
|---|---|
| Prompt vazio | Cartão renderiza com todas seções como "ausente", barras zeradas, footer `0 / 8.000`. |
| Persona com 3.500 chars, outras curtas | Barra Persona vermelha (>35% do limite); badge "🔥 Maior contribuinte" em Persona. |
| Seção thin (4 palavras) | Stats mostram chars reais + ícone amber (já que está presente mas curta). |
| Seção missing | Linha cinza com "— ausente", sem barra; não conta para `topKey`. |
| Conteúdo fora das 4 seções (preâmbulo, comentários) | Linha "Outros" com chars correspondentes; ajuda a explicar gap entre soma de seções e total. |
| Click numa linha | Cursor pula para a seção no editor (mesma UX do checklist). |

### Arquivos tocados

- **Criar** `src/components/agents/wizard/quickSteps/PromptSectionUsage.tsx` (~120 linhas).
- **Editar** `src/components/agents/wizard/quickSteps/StepQuickPrompt.tsx` — 1 import + 1 render (~3 linhas).

### Impacto

- Zero schema/backend, zero dependência nova.
- Reaproveita 100% da lógica de `locateSections` já madura — sem duplicar parsers.
- Resolve o ponto cego: agora dá pra ver de relance **qual seção cortar primeiro** quando o prompt fica grande.

