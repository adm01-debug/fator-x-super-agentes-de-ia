

## Diff visual de guardrails com resumo por categoria, severidade e thresholds

Hoje a comparação de versões mostra guardrails como uma simples tabela "está / não está" pelo nome. Vou trocar essa tabela por um painel rico que destaca:

1. **Resumo por categoria** (`input_validation`, `output_safety`, `access_control`, `operational`).
2. **Mudanças de severidade** (`block` ↔ `warn` ↔ `log`) em guardrails que continuam ativos.
3. **Mudanças de threshold/config** (qualquer chave dentro de `config: Record<string, unknown>`).
4. **Adições, remoções e itens estáveis** com badges visuais.

### Visão final

```text
┌─ Guardrails ──────────────── 12 totais · 3 mudanças ─┐
│  + 1 adicionada    − 1 removida    ⚙ 1 alterada      │
│                                                       │
│  Por categoria                                        │
│  🛡 input_validation     v3:  4 → v5:  4   (=)        │
│  🚫 output_safety        v3:  3 → v5:  4   (+1)       │
│  🔐 access_control       v3:  2 → v5:  1   (−1)       │
│  ⚙ operational          v3:  3 → v5:  3   (=)        │
│                                                       │
│  Severidade (apenas itens em ambas)                   │
│  pii_detection           warn → block   ↑ mais estrito│
│  toxicity                block → warn   ↓ mais leve   │
│                                                       │
│  Thresholds / config                                  │
│  pii_detection           confidence  0.7 → 0.85       │
│  rate_limiter            max_rpm    60 → 30           │
│                                                       │
│  ▸ Ver detalhes de todos os guardrails                │
│  ┌─ tabela colapsável (estado atual: nome/cat/sev) ─┐ │
└───────────────────────────────────────────────────────┘
```

### Componentes / mudanças

**1. Estender `src/lib/agentChangelog.ts`** (puro, sem UI):
- Novo tipo `GuardrailLike { id?, name?, category?, severity?, enabled?, config? }`.
- Novo helper `getVersionGuardrailObjects(v)` retornando array completo de guardrails (não só nomes).
- Novo `diffGuardrails(prev, next): GuardrailDiff` com:
  ```ts
  interface GuardrailDiff {
    added: GuardrailLike[];
    removed: GuardrailLike[];
    kept: Array<{
      key: string;             // name||id
      prev: GuardrailLike;
      next: GuardrailLike;
      severityChanged?: { from: string; to: string };
      configChanges: Array<{ key: string; from: unknown; to: unknown }>;
    }>;
    byCategory: Record<string, { prev: number; next: number; delta: number }>;
    summary: { added: number; removed: number; modified: number; total: number };
  }
  ```
- `generateChangelog` continua funcionando como hoje (compat); o painel novo usa `diffGuardrails` direto para riqueza extra.

**2. Novo `src/components/agents/versioning/GuardrailsDiffPanel.tsx`**:
- Recebe `versionA`, `versionB`.
- Header com contagem total + mini-badges (`+N`, `-N`, `⚙ N`).
- **Bloco "Por categoria"**: lista das 4 categorias conhecidas com contagem antes/depois, delta colorido (verde se cresceu em safety, neutro caso contrário).
- **Bloco "Severidade"**: só itens em ambas as versões com mudança; ícone de seta + rótulo "mais estrito"/"mais leve" (block > warn > log).
- **Bloco "Thresholds / config"**: lista plana `nome · key   from → to` (formata números, booleanos, strings curtos; `JSON.stringify` truncado para objetos).
- **Detalhes colapsável** (`<details>` nativo): tabela com nome, categoria, severidade, status (`+ adicionada`, `− removida`, `⚙ alterada`, `=`).
- Tudo com tokens semânticos (`--nexus-emerald`, `--destructive`, `--nexus-amber`, `--primary`, `--muted-foreground`).
- Empty state amigável quando não há guardrails em nenhuma versão.

**3. Editar `src/components/agents/versioning/VersionComparePanel.tsx`**:
- Substituir o atual `<DiffTable title="Guardrails" ... />` por `<GuardrailsDiffPanel versionA={versionA} versionB={versionB} />`.
- Manter o `DiffTable` existente para "Ferramentas" intacto (escopo isolado).
- Layout: o painel de guardrails vira full-width abaixo do prompt (em vez de dividir o grid 50/50 com Tools), porque tem mais conteúdo. Tools fica acima sozinho num card largo, ou em grid 2-col com um espaço reservado vazio — escolho **stack vertical** (Tools full-width, depois Guardrails full-width) para legibilidade.

### Detalhes técnicos

- **Compatibilidade retroativa**: versões antigas que guardam guardrails só como `{ name, enabled }` continuam funcionando — campos faltantes viram "—" nas células e simplesmente não geram entradas em "Severidade" ou "Thresholds".
- **Identidade do guardrail**: chave de matching = `name || id` (igual ao `enabledNames` atual), garantindo que comparação não quebre quando IDs são gerados em runtime.
- **Sem mudança de schema, sem backend, sem migração** — leitura pura de `version.config.guardrails`.
- **Reaproveitamento**: a função `diffGuardrails` fica em `agentChangelog.ts` e pode ser usada futuramente em alertas de auditoria (ex.: "guardrail X foi enfraquecido na v7").
- **Acessibilidade**: cada bloco tem heading `<h4>`, ícones `aria-hidden`, mudanças de severidade com texto descritivo (não só cor).
- **Performance**: diff é O(n) no nº de guardrails (tipicamente <30); roda sincronamente no render.

### Arquivos

- **Editar**: `src/lib/agentChangelog.ts` — adicionar `diffGuardrails`, `getVersionGuardrailObjects`, tipo `GuardrailDiff`.
- **Criar**: `src/components/agents/versioning/GuardrailsDiffPanel.tsx`.
- **Editar**: `src/components/agents/versioning/VersionComparePanel.tsx` — trocar a `DiffTable` de guardrails pelo novo painel e ajustar o layout para stack vertical.

### Impacto

- Revisor de versão vê em segundos **o que mudou em proteção** (não só "quantos itens"): se pii_detection ficou mais estrito, se um guardrail crítico foi removido, se thresholds foram afrouxados.
- Resumo por categoria revela rapidamente desequilíbrios (ex.: "v5 removeu access_control sem ganhar nada em troca").
- Zero impacto fora do painel de comparação; ferramentas, prompt e changelog automático seguem idênticos.

