# Guia de Contribuicao

> Como contribuir para o projeto Fator X Super Agentes de IA.

---

## Fluxo de Trabalho com Git

### Branches

- **`main`** — branch de producao. Sempre estavel e deployavel.
- **`feature/*`** — novas funcionalidades. Ex: `feature/chat-streaming`
- **`fix/*`** — correcoes de bugs. Ex: `fix/login-redirect-loop`
- **`refactor/*`** — refatoracoes sem mudanca de comportamento. Ex: `refactor/extract-agent-hook`
- **`hotfix/*`** — correcoes urgentes em producao. Ex: `hotfix/supabase-rls-bypass`

### Fluxo Padrao

```bash
# 1. Criar branch a partir de main (sempre atualizada)
git checkout main
git pull origin main
git checkout -b feature/minha-feature

# 2. Desenvolver com commits pequenos e frequentes
git add src/components/MeuComponente.tsx
git commit -m "feat: adicionar componente de chat"

# 3. Manter a branch atualizada com main
git fetch origin
git rebase origin/main

# 4. Push e criar Pull Request
git push -u origin feature/minha-feature
# Criar PR via GitHub
```

### Regras

- **Nunca** commitar diretamente na `main`
- **Sempre** criar Pull Request para merge
- **Sempre** manter a branch atualizada com `main` via rebase (nao merge)
- **Deletar** a branch apos o merge

---

## Convencao de Commits

Usamos [Conventional Commits](https://www.conventionalcommits.org/) para manter um historico limpo e gerar changelogs automaticamente.

### Formato

```
<tipo>(<escopo opcional>): <descricao>

[corpo opcional]

[rodape opcional]
```

### Tipos Permitidos

| Tipo | Descricao | Exemplo |
|------|-----------|---------|
| `feat` | Nova funcionalidade | `feat(agents): adicionar suporte a streaming` |
| `fix` | Correcao de bug | `fix(auth): corrigir loop de redirect no login` |
| `refactor` | Refatoracao sem mudanca de comportamento | `refactor(hooks): extrair logica de useAgent` |
| `docs` | Documentacao | `docs: atualizar README com instrucoes de setup` |
| `test` | Adicionar ou corrigir testes | `test(agents): adicionar testes para AgentCard` |
| `chore` | Tarefas de manutencao (deps, CI, config) | `chore: atualizar dependencias do Radix` |
| `style` | Formatacao, sem mudanca de logica | `style: aplicar formatacao do Prettier` |
| `perf` | Melhoria de performance | `perf(queries): adicionar indice em conversations` |
| `ci` | Mudancas no CI/CD | `ci: adicionar step de type-check no pipeline` |

### Regras

- Descricao em portugues ou ingles (manter consistencia no PR)
- Primeira letra minuscula, sem ponto final
- Imperativo: "adicionar", nao "adicionado" ou "adicionando"
- Maximo de 72 caracteres na primeira linha
- Breaking changes devem incluir `BREAKING CHANGE:` no rodape ou `!` apos o tipo

### Exemplos

```bash
# Bom
git commit -m "feat(chat): adicionar envio de imagens no chat"
git commit -m "fix(auth): resolver erro 401 ao renovar token"
git commit -m "refactor(agents): simplificar logica de criacao de agente"

# Ruim
git commit -m "fix bug"
git commit -m "Atualizacoes diversas"
git commit -m "WIP"
```

---

## Requisitos para Pull Requests

### Antes de Abrir o PR

Rodar todos os checks localmente:

```bash
# TypeScript - sem erros de tipo
bun run types:check

# Lint - sem warnings ou erros
bun run lint

# Testes unitarios - todos passando
bun run test

# Build - deve compilar sem erros
bun run build
```

### Checklist do PR

- [ ] Branch atualizada com `main` (rebase recente)
- [ ] `bun run types:check` passa sem erros
- [ ] `bun run lint` passa sem erros
- [ ] `bun run test` passa sem erros
- [ ] `bun run build` compila sem erros
- [ ] Testes adicionados para logica nova ou alterada
- [ ] Descricao do PR explica o **por que** da mudanca
- [ ] Screenshots incluidos para mudancas visuais
- [ ] Sem `console.log` no codigo (usar `logger` do projeto)
- [ ] Sem `any` no TypeScript (usar tipos explicitos)
- [ ] Sem secrets ou credenciais commitados

### Descricao do PR

Usar o template:

```markdown
## O que muda?
[Descricao breve das mudancas]

## Por que?
[Motivacao e contexto]

## Como testar?
[Passos para validar as mudancas]

## Screenshots (se aplicavel)
[Antes/depois para mudancas visuais]
```

---

## SLA de Code Review

| Tipo de PR | Tempo para primeira revisao | Tempo para aprovacao |
|------------|----------------------------|----------------------|
| PR regular | 24 horas | 48 horas |
| Hotfix (P0/P1) | 4 horas | 8 horas |
| Dependabot / deps | 48 horas | 72 horas |

### Regras de Review

- **Minimo 1 aprovacao** para merge em `main`
- **Hotfixes** podem ser aprovados pelo Tech Lead sozinho
- Reviewer deve focar em: corretude, seguranca, performance, legibilidade
- Usar "Request Changes" apenas para problemas que **devem** ser corrigidos
- Usar "Comment" para sugestoes opcionais
- Nao bloquear PR por preferencias de estilo se o lint passa

### Boas Praticas como Reviewer

- Seja construtivo: explique o *por que*, nao apenas o *o que* mudar
- Sugira codigo alternativo quando possivel (use "suggestion" do GitHub)
- Reconheca o que esta bom, nao apenas o que precisa mudar
- Se o PR esta grande demais (> 400 linhas), peca para dividir

---

## Requisitos de Testes

### Testes Unitarios (Vitest)

Obrigatorios para:
- Funcoes utilitarias (`src/lib/`, `src/utils/`)
- Custom hooks (`src/hooks/`)
- Logica de negocio (parsers, validadores, transformadores)
- Reducers e state management

```typescript
// Exemplo: src/lib/format-agent-name.test.ts
import { describe, it, expect } from 'vitest';
import { formatAgentName } from './format-agent-name';

describe('formatAgentName', () => {
  it('deve capitalizar a primeira letra', () => {
    expect(formatAgentName('assistente')).toBe('Assistente');
  });

  it('deve retornar string vazia para input undefined', () => {
    expect(formatAgentName(undefined)).toBe('');
  });
});
```

### Testes E2E (Playwright)

Obrigatorios para:
- Fluxos criticos do usuario (login, criacao de agente, conversa)
- Fluxos de pagamento (se aplicavel)
- Fluxos que envolvem multiplas paginas

```typescript
// Exemplo: e2e/login.spec.ts
import { test, expect } from '@playwright/test';

test('usuario deve conseguir fazer login', async ({ page }) => {
  await page.goto('/login');
  await page.fill('[name="email"]', 'test@example.com');
  await page.fill('[name="password"]', 'senha123');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL('/dashboard');
});
```

### Quando testar

| Mudanca | Teste unitario | Teste E2E |
|---------|---------------|-----------|
| Nova funcao utilitaria | Obrigatorio | - |
| Novo hook | Obrigatorio | - |
| Novo componente com logica | Obrigatorio | - |
| Novo fluxo de paginas | - | Obrigatorio |
| Fix de bug | Obrigatorio (para evitar regressao) | Se envolve UI |
| Refatoracao | Testes existentes devem continuar passando | - |

---

## Guia de Estilo

### TypeScript

- **Strict mode** habilitado (`"strict": true` no `tsconfig.json`)
- **Nunca** usar `any` — usar `unknown` e fazer type narrowing, ou criar tipos especificos
- **Nunca** usar `@ts-ignore` — usar `@ts-expect-error` com justificativa se absolutamente necessario
- Preferir `interface` para objetos, `type` para unions e intersections
- Exportar tipos junto com as funcoes que os usam

```typescript
// Bom
interface AgentConfig {
  name: string;
  model: 'gpt-4' | 'claude-3';
  temperature: number;
}

function createAgent(config: AgentConfig): Agent {
  // ...
}

// Ruim
function createAgent(config: any): any {
  // ...
}
```

### Logging

- **Nunca** usar `console.log`, `console.warn` ou `console.error` em codigo de producao
- Usar o `logger` do projeto (`src/lib/logger.ts` ou similar)
- Incluir contexto estruturado nas mensagens de log

```typescript
// Bom
logger.info('Agente criado com sucesso', { agentId, userId });
logger.error('Falha ao criar agente', { error, agentConfig });

// Ruim
console.log('agente criado');
console.error(error);
```

### Componentes React

- Um componente por arquivo
- Usar named exports (nao default exports)
- Props tipadas com `interface` no mesmo arquivo
- Desestruturar props na assinatura da funcao

```typescript
// Bom
interface AgentCardProps {
  agent: Agent;
  onSelect: (id: string) => void;
}

export function AgentCard({ agent, onSelect }: AgentCardProps) {
  return (/* ... */);
}
```

### Estilo e CSS

- Usar Tailwind CSS para estilizacao
- Componentes do shadcn/ui para elementos de interface
- Nao usar CSS inline (`style={{}}`) exceto para valores dinamicos
- Seguir o sistema de design existente (cores, espacamentos, tipografia via Tailwind config)

### Imports

- Usar path aliases (`@/` para `src/`)
- Ordenar imports: React > libs externas > componentes internos > utils > tipos
- Nao usar imports relativos com `../../` (usar `@/`)

```typescript
// Bom
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAgent } from '@/hooks/useAgent';
import { formatDate } from '@/lib/utils';
import type { Agent } from '@/types';
```

---

## Ambiente de Desenvolvimento

### Setup Inicial

```bash
# Clonar o repositorio
git clone <url-do-repo>
cd fator-x-super-agentes-de-ia

# Instalar dependencias
bun install

# Copiar variaveis de ambiente
cp .env.example .env.local
# Editar .env.local com suas credenciais

# Iniciar o servidor de desenvolvimento
bun run dev
```

### Comandos Uteis

```bash
bun run dev          # Servidor de desenvolvimento
bun run build        # Build de producao
bun run test         # Rodar testes unitarios
bun run test:watch   # Testes em modo watch
bun run test:e2e     # Testes E2E com Playwright
bun run lint         # Verificar lint
bun run types:check  # Verificar tipos TypeScript
```

---

## Duvidas?

- Abra uma issue com a label `question`
- Pergunte no canal do Slack do time
- Consulte os outros docs em `/docs/` (ARCHITECTURE.md, RUNBOOK.md, ONBOARDING.md)
