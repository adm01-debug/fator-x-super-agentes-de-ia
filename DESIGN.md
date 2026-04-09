# 🎨 DESIGN.md — Nexus Agents Studio / FATOR X

**Última atualização:** 2026-04-09
**Propósito:** Referência visual canônica do Nexus. Coding agents (Lovable, Claude Code, Cursor, Codex) devem ler este arquivo **antes** de gerar qualquer UI para garantir consistência com o resto do produto. Humanos podem usá-lo como guia rápido de onboarding visual.

**Fontes de verdade do código (este doc reflete o que está nelas, não o contrário):**

- `tailwind.config.ts` — tokens de tema, fontes, keyframes, animações
- `src/index.css` — CSS custom properties (light + dark), utility classes `.nexus-*`, animações globais
- `components.json` — configuração shadcn/ui
- `src/App.tsx` — composição raiz (providers, layout, suspense/error boundaries)

Se este doc divergir do código, **o código vence**. Atualize este arquivo no mesmo commit que mudar os tokens.

---

## 1. Filosofia visual

### Princípios

1. **Dark-first, light disponível.** O app roda em modo escuro por padrão (`defaultTheme="dark"` no `ThemeProvider`). O modo light existe e é suportado, mas 90% do trabalho visual é testado primeiro em dark. Cores Nexus (`--nexus-*`) são ajustadas separadamente em `:root` e `.dark` — nunca use um HSL literal num componente; use a variável.

2. **Tokens semânticos acima de cores literais.** Botões primários usam `bg-primary`, não `bg-blue-500`. Cards usam `bg-card`, não `bg-white`. Isso é o que permite o theme switching funcionar em tempo real sem recarregar.

3. **Movimento é comunicação, não decoração.** Cada animação tem função (entrada de card, feedback de click, loading state, status ativo). Respeite `prefers-reduced-motion` — o CSS já tem o bloco global que desliga tudo.

4. **Acessibilidade é default, não opção.** Focus ring global de 2px + offset. Contraste WCAG AA no muted-foreground dark (HSL `215 15% 75%`). Touch targets mínimo 44px em telas < 640px.

5. **Consistência > criatividade individual.** Se existir um utility class `.nexus-*` que resolve o caso, use. Se não existir, crie uma nova classe em `src/index.css` em vez de inline styles.

---

## 2. Tipografia

Três famílias, todas carregadas via Google Fonts no topo do `src/index.css`:

| Uso | Família | Pesos | Variável CSS | Classe Tailwind |
|---|---|---|---|---|
| **Headings** (h1–h6, bold, semibold) | Space Grotesk | 300, 400, 500, 600, 700 | `var(--font-heading)` | `font-heading` |
| **Body** (p, li, span, labels, inputs) | Inter | 300, 400, 500, 600, 700 | `var(--font-body)` | `font-body` |
| **Code, mono** (`code`, `pre`, valores técnicos) | JetBrains Mono | 400, 500, 600 | `var(--font-mono)` | `font-mono` |

### Regras

- **Headings herdam `font-heading` automaticamente** via `src/index.css` — não precisa adicionar a classe em `<h1>`, `<h2>`, etc.
- **Bold/semibold também puxam `font-heading`** (regra global em `index.css`, fora de `@layer`, pra ganhar em especificidade). Isso significa que `<span className="font-bold">` vira Space Grotesk, mesmo dentro de um parágrafo Inter.
- **`code`, `pre`, `.font-mono` sempre vencem com `!important`** — não há como sobrescrever acidentalmente.
- **Tracking (letter-spacing) compacto em headings:** h1 usa `-0.035em`, h2 `-0.03em`, h3 `-0.02em`, h4–h6 `-0.025em`. Line-height de h1 é `1.1`, demais `1.2`. Body é `1.6`.

### Hierarquia sugerida (não rígida)

- `text-4xl font-bold` → page title (h1)
- `text-2xl font-semibold` → section title (h2)
- `text-lg font-semibold` → card title (h3)
- `text-sm text-muted-foreground` → helper text, labels, meta
- `text-xs uppercase tracking-wider text-muted-foreground` → section label (use `.nexus-section-title`)

---

## 3. Paleta de cores

Todas as cores são definidas como **HSL sem a função `hsl()`** nas CSS variables (pra permitir opacidade via `hsl(var(--x) / 0.5)`). Em Tailwind elas viram `bg-primary`, `text-muted-foreground`, etc.

### 3.1 Tokens semânticos (shadcn + customização)

Os valores abaixo estão em formato `H S% L%`.

| Token | Light (`:root`) | Dark (`.dark`) | Uso |
|---|---|---|---|
| `--background` | `220 25% 96%` | `230 33% 5%` | fundo da página |
| `--foreground` | `220 25% 10%` | `210 20% 92%` | texto principal |
| `--card` | `0 0% 100%` | `232 29% 8%` | fundo de cards |
| `--card-foreground` | `220 25% 10%` | `210 20% 92%` | texto dentro de cards |
| `--popover` | `0 0% 100%` | `232 29% 8%` | dropdowns, tooltips, context menus |
| `--primary` | `250 80% 60%` (roxo) | `214 100% 65%` (azul) | ações principais, links ativos, focus ring |
| `--primary-foreground` | `0 0% 100%` | `0 0% 100%` | texto sobre primary |
| `--secondary` | `220 15% 92%` | `232 25% 12%` | botões secundários, chips |
| `--muted` | `220 15% 94%` | `232 25% 12%` | fundos sutis, disabled states |
| `--muted-foreground` | `220 15% 32%` | `215 15% 75%` ⭐ | texto secundário (helper, timestamps). Dark ajustado pra WCAG AA. |
| `--accent` | `170 70% 45%` (teal) | `142 50% 56%` (green) | badges, destaques |
| `--destructive` | `0 72% 55%` | `0 72% 55%` | delete, erros, actions destrutivas |
| `--border` | `220 15% 88%` | `235 30% 17%` | bordas de cards, inputs, separadores |
| `--input` | `220 15% 88%` | `235 30% 17%` | bordas de inputs |
| `--ring` | `250 80% 60%` | `214 100% 65%` | focus ring (igual a primary) |
| `--radius` | `0.625rem` | — | border-radius base (usado em `lg`, `md`, `sm` via Tailwind) |

**Observação importante sobre primary:** no modo light o primary é **roxo** (`250 80% 60%`) e no dark é **azul** (`214 100% 65%`). Isso é intencional — o roxo satura demais em fundo escuro, o azul contrasta mal com fundo claro. Não tente unificar.

### 3.2 Tokens Nexus (cores de domínio)

Cores semânticas específicas do produto. Usadas para status, labels de canais, gráficos. Sempre prefira estas em vez de cores "hard-coded" do Tailwind (`text-green-500`, etc.).

| Token Tailwind | CSS Variable | Light | Dark | Uso típico |
|---|---|---|---|---|
| `text-nexus-cyan` / `bg-nexus-cyan` | `--nexus-cyan` | `185 80% 55%` | `185 80% 60%` | Bitrix24 label, info states |
| `text-nexus-emerald` | `--nexus-emerald` | `160 70% 45%` | `142 50% 56%` | WhatsApp label, success |
| `text-nexus-amber` | `--nexus-amber` | `38 92% 55%` | `48 95% 55%` | Gmail label, warnings |
| `text-nexus-rose` | `--nexus-rose` | `350 75% 55%` | `0 75% 55%` | errors, danger |
| `text-nexus-blue` | `--nexus-blue` | `214 90% 65%` | `214 100% 65%` | chart primary |
| `text-nexus-green` | `--nexus-green` | `142 60% 60%` | `142 50% 56%` | chart positive |
| `text-nexus-yellow` | `--nexus-yellow` | `48 95% 62%` | `48 95% 55%` | chart warning |
| `text-nexus-red` | `--nexus-red` | `0 75% 58%` | `0 75% 55%` | chart negative |
| `text-nexus-purple` | `--nexus-purple` | `280 45% 55%` | `280 55% 55%` | LGPD, special features |
| `text-nexus-orange` | `--nexus-orange` | `28 80% 52%` | `28 80% 52%` | promo, price highlight |
| `text-nexus-gold` | `--nexus-gold` | `28 50% 65%` | `28 50% 65%` | premium, gold tier |
| `text-nexus-teal` | `--nexus-teal` | `170 65% 45%` | `170 65% 50%` | datahub, technical |
| `bg-nexus-surface-1/2/3` | `--nexus-surface-1/2/3` | shades of gray | shades of dark | layered surfaces |
| `shadow-[nexus-glow]` | `--nexus-glow` | `250 80% 65%` | `214 100% 65%` | hover glow (use via utility classes) |

### 3.3 Mapeamento para SOURCE_LABELS

O service `agentRoutingService.ts` já define o mapeamento canônico de source → label + icon + color:

```ts
bitrix24: { label: 'Bitrix24', icon: 'Building2',     color: 'text-nexus-cyan' }
whatsapp: { label: 'WhatsApp', icon: 'MessageCircle', color: 'text-nexus-emerald' }
gmail:    { label: 'Gmail',    icon: 'Mail',          color: 'text-nexus-amber' }
slack:    { label: 'Slack',    icon: 'Slack',         color: 'text-primary' }
```

Ao adicionar uma nova integração (ex: Teams, Discord), adicione a entrada em `SOURCE_LABELS` e escolha uma cor Nexus que já exista — **não** crie um token novo só pra ela.

---

## 4. Layout e espaçamento

### 4.1 Container

Todas as páginas do app são envelopadas pelo `AppLayout` (sidebar + header + main). O conteúdo interno de cada page deve usar:

```tsx
<div className="nexus-page">
  <div className="nexus-page-content">
    {/* ... */}
  </div>
</div>
```

- **`.nexus-page`**: `p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto` — padding responsivo + largura máxima fixa
- **`.nexus-page-content`**: `space-y-6 sm:space-y-8` — espaçamento vertical entre sections

### 4.2 Breakpoints

Padrão Tailwind:

- `sm` — 640px
- `md` — 768px
- `lg` — 1024px
- `xl` — 1280px
- `2xl` — 1400px (também é o max-width do container)

Mobile-first: escreva estilos para `< 640px` primeiro, depois adicione overrides para `sm:`, `lg:`, etc.

### 4.3 Border radius

Baseado em `--radius: 0.625rem` (10px):

- `rounded-lg` → `var(--radius)` = 10px — **default para cards e botões grandes**
- `rounded-md` → `calc(var(--radius) - 2px)` = 8px — botões, inputs
- `rounded-sm` → `calc(var(--radius) - 4px)` = 6px — chips, badges, pequenos elementos
- `rounded-xl` → 12px (Tailwind default) — cards "heavy" tipo `.nexus-card`
- `rounded-full` → pills, avatares, status dots

---

## 5. Surfaces (camadas de superfície)

Três níveis hierárquicos de elevação via `--nexus-surface-1/2/3`:

- **Surface 1** (mais próximo do background): fundos de seção, sidebar
- **Surface 2**: cards normais
- **Surface 3**: cards elevados, modais, popovers

Utility classes prontas no `index.css`:

### `.nexus-card`

Card padrão. Use pra listar itens, mostrar métricas, conter forms.

```tsx
<div className="nexus-card">
  <h3 className="font-semibold">Título</h3>
  <p className="text-sm text-muted-foreground">Descrição</p>
</div>
```

- Rounded `xl`, padding `5` (`p-5`), border sutil, sombra interna leve
- **Hover:** translada `-2px`, aumenta sombra, border vira `primary/35%`, background ganha gradiente sutil de primary a 4%
- Transição cubic-bezier `0.3s`

### `.nexus-card-elevated`

Igual ao `.nexus-card` mas com sombra mais forte. Use pra cards "principais" de uma página (dashboard hero cards, Oracle panel, etc.).

### `.nexus-card-interactive`

Cursor pointer + efeito de click. Use pra cards que levam a outras páginas (lista de agentes, workflows, deployments).

- Hover: translada `-3px`, scale `1.01`, glow mais intenso
- Active (clicked): scale `0.98`, transição rápida de 0.1s
- Mínimo 44px de altura em mobile (`< 640px`)

### `.nexus-glass` e `.nexus-glass-heavy`

Semi-transparente com border. Use pra overlays, modais, dropdowns que precisam deixar ver algo atrás.

- `.nexus-glass`: `bg-card/92` + `border-border/70`
- `.nexus-glass-heavy`: `bg-card/96` + `border-border/75`

---

## 6. Badges (status + labels)

Seis variantes prontas. Sempre use estas em vez de pintar badge à mão:

```tsx
<span className="nexus-badge-success">Ativo</span>
<span className="nexus-badge-warning">Pendente</span>
<span className="nexus-badge-danger">Falha</span>
<span className="nexus-badge-info">Info</span>
<span className="nexus-badge-primary">Destaque</span>
<span className="nexus-badge-muted">Rascunho</span>
```

Cada variante é `inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium` + background a 12% da cor e texto na cor cheia.

**Mapeamento semântico:**

- `success` → `--nexus-emerald` → states "ativo", "concluído", "saudável"
- `warning` → `--nexus-amber` → states "pendente", "atenção", "slow"
- `danger` → `--nexus-rose` → states "falha", "erro", "overdue"
- `info` → `--nexus-cyan` → states informativos, tags neutras
- `primary` → `--primary` → states "em destaque", "novo"
- `muted` → `--muted-foreground` → states "rascunho", "arquivado", "desativado"

---

## 7. Animações e micro-interações

### 7.1 Animações globais disponíveis (já em `index.css`)

| Classe | Duração | Uso |
|---|---|---|
| `.animate-fade-in` | 0.2s | entrada suave de conteúdo |
| `.animate-fade-in-up` | 0.25s | entrada com deslocamento Y pequeno |
| `.animate-card-enter` | 0.35s | entrada de card (scale + translateY) |
| `.animate-page-enter` | 0.18s | fade-in de página inteira |
| `.animate-scale-in` | 0.2s | entrada de modal/dialog |
| `.animate-slide-up` | 0.3s | entrada de bottom sheet |
| `.animate-number-pop` | 0.4s | animated counters (dashboard metrics) |
| `.animate-glow-pulse` | 2s loop | status dots ativos |
| `.animate-border-glow` | 2s loop | cards em foco/ativos |
| `.animate-chart-reveal` | 0.5s (delay 0.15s) | entrada de gráficos |

### 7.2 Stagger (entrada sequencial de listas)

Duas classes pai disponíveis, cada uma controla até **8 filhos** com delays de 50ms:

- `.stagger-children` — usa `card-enter` (scale + Y) — ideal pra grid de cards
- `.stagger-list` — usa `slide-in-right` — ideal pra listas verticais (sidebar items, linhas de tabela)

```tsx
<div className="stagger-children grid grid-cols-3 gap-4">
  <Card /> <Card /> <Card />
</div>
```

### 7.3 Skeleton loading

Duas classes equivalentes para shimmer em placeholders:

- `.skeleton-shimmer`
- `.shimmer`

Ambas aplicam gradiente animado `hsl(var(--muted) / 0.3-0.5)` com ciclo de 1.5s.

```tsx
<div className="skeleton-shimmer h-4 w-32 rounded" />
```

### 7.4 Micro-interações de botões

- **`.nexus-btn-press`** — aplica `scale(0.97)` no `:active`, transição 0.1s. Sinta o click.
- **`.nexus-focus-ring`** — focus ring primary/50% com offset (complementa o global).

### 7.5 Regra inviolável: `prefers-reduced-motion`

O `index.css` já contém o bloco global que desliga todas as animações quando o usuário pediu. **Não crie animações inline** (`style={{ animation: '...' }}`) — elas escapam do override de reduced-motion. Sempre use classes `.animate-*` ou keyframes declaradas no CSS.

---

## 8. Scrollbar e focus

### Scrollbar (custom, 6px, primary translúcido)

Aplicada globalmente via `::-webkit-scrollbar`. Se precisar esconder em algum container específico:

```tsx
<div className="scrollbar-hide">...</div>
```

### Focus ring global

Qualquer elemento focado por teclado ganha `outline: 2px solid hsl(var(--primary))` com offset 2px. Elementos interativos (`button`, `a`, `input`, etc.) ganham `ring-2 ring-ring ring-offset-1` arredondado. **Não desabilite focus visible em lugar nenhum** — é o que torna o produto usável com teclado.

### Seleção de texto

Selection color é `hsl(var(--primary) / 0.25)`. Não sobrescreva.

---

## 9. Composição de página padrão

Toda página do Nexus segue este esqueleto (ver `src/App.tsx` e pages existentes pra referência):

```tsx
// src/pages/ExamplePage.tsx
import { useEffect } from 'react';
import { useTranslation } from '@/hooks/useI18n';

export default function ExamplePage() {
  const { t } = useTranslation();

  useEffect(() => {
    document.title = `${t('example.title')} · Nexus`;
  }, [t]);

  return (
    <div className="nexus-page animate-page-enter">
      <div className="nexus-page-content">
        {/* Header */}
        <header className="space-y-1">
          <h1 className="text-3xl font-bold">{t('example.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('example.subtitle')}</p>
        </header>

        {/* Content */}
        <section className="stagger-children grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* cards */}
        </section>
      </div>
    </div>
  );
}
```

### Roteamento

No `src/App.tsx`, toda rota protegida é envelopada por:

```tsx
<Route path="/example" element={<SafePage><ExamplePage /></SafePage>} />
```

- **`<SafePage>`** = `<ErrorBoundary><Suspense fallback={<PageLoading />}>…</Suspense></ErrorBoundary>`
- Páginas são `lazy()` imports pra code-splitting
- Rotas que precisam de RBAC: envelopar em `<ProtectedRoute permission="...">` antes da page

**Regra:** nunca adicione uma page sem `<SafePage>`. Nunca esqueça de registrar a rota (vide sprint #4 — `RoutingConfigPage` ficou 3 sessões sem rota registrada).

---

## 10. Componentes externos

### shadcn/ui

Configurado via `components.json`. Componentes instalados estão em `src/components/ui/`. Antes de criar um componente novo do zero, **verifique se já existe um shadcn**:

- `Button`, `Input`, `Textarea`, `Select`, `Checkbox`, `Switch`, `Slider`
- `Card`, `Tabs`, `Accordion`, `Collapsible`, `Separator`
- `Dialog`, `AlertDialog`, `Sheet`, `Popover`, `Tooltip`, `DropdownMenu`, `ContextMenu`
- `Toast` (+ `sonner` pra toasts modernos), `Alert`
- `Avatar`, `Badge`, `Progress`, `Skeleton`
- `Table`, `Command`, `ScrollArea`, `Calendar`

Se precisar estender, faça wrapper em `src/components/shared/` ou `src/components/layout/` — **não edite os arquivos em `src/components/ui/`** (são overridable pelo CLI do shadcn).

### lucide-react

Biblioteca de ícones oficial. **Sempre use lucide**, nunca `react-icons`, `heroicons` nem SVG inline.

```tsx
import { GitBranch, Users, Settings } from 'lucide-react';

<GitBranch className="h-4 w-4 text-muted-foreground" />
```

Tamanhos padrão: `h-3 w-3` (inline), `h-4 w-4` (default em botões), `h-5 w-5` (headers de card), `h-6 w-6` (page icons).

### sonner (toasts)

Use o `toast` helper importado de `sonner`, não `useToast` do shadcn. Já está montado no `App.tsx`.

```tsx
import { toast } from 'sonner';

toast.success('Salvo');
toast.error('Falhou', { description: 'Detalhes do erro' });
```

`QueryClient` já está configurado pra disparar `toast.error` automaticamente em mutation errors — não precisa duplicar.

### @tanstack/react-query

State server. Toda chamada a service/API passa por `useQuery` ou `useMutation`. Configuração global em `App.tsx`:

- `staleTime: 5min`, `gcTime: 10min`
- Retry: 2 tentativas em falhas genéricas, **zero retry** em 401/403
- `refetchOnWindowFocus: false`

### next-themes

`ThemeProvider` envolve tudo com `attribute="class"` e `defaultTheme="dark"`. Para trocar tema, use `useTheme()` do próprio `next-themes`.

### i18n (via `useI18n`)

Todas as strings passam pelo `I18nProvider` (já no App.tsx). Usar:

```tsx
import { useTranslation } from '@/hooks/useI18n';
const { t } = useTranslation();
t('agents.create.title');
```

**Nunca hard-code texto visível em português ou inglês** — sempre key de tradução.

---

## 11. RBAC visual

O Nexus tem 5 roles e 32 permissions. No frontend, isso aparece em dois lugares:

### 11.1 Rotas protegidas

No `App.tsx`:

```tsx
<Route path="/admin" element={
  <SafePage>
    <ProtectedRoute permission="team.roles">
      <AdminPage />
    </ProtectedRoute>
  </SafePage>
} />
```

Se o usuário não tem a permission, o `ProtectedRoute` mostra fallback apropriado (geralmente redirect ou mensagem).

### 11.2 Botões de ação sensíveis

Wrappar em `<AccessControl>` (ainda a ser integrado — ver WAVE 6 do `BACKLOG-10-10.md`):

```tsx
<AccessControl permission="agents.deploy">
  <Button>Deploy</Button>
</AccessControl>
```

Isso esconde ou desabilita o botão baseado no perfil. **Hoje muitos botões ainda não estão wrapped** — ao tocar em uma page existente, aproveite e adicione o wrapping nos botões sensíveis.

---

## 12. O que NÃO fazer

- ❌ `className="bg-[#3b82f6]"` — nunca cores hard-coded. Use `bg-primary` ou `bg-nexus-blue`.
- ❌ `className="bg-blue-500"` — nunca cores Tailwind default em componentes do produto. A exceção é código de teste ou storybook temporário.
- ❌ `style={{ animation: 'fadeIn 0.3s' }}` — animações inline escapam do reduced-motion. Use classe `.animate-fade-in`.
- ❌ `<div style={{ padding: '24px' }}>` — use `p-6`.
- ❌ `import { Bell } from 'react-icons/fa'` — use `import { Bell } from 'lucide-react'`.
- ❌ Criar um componente de card do zero quando `.nexus-card` já resolve.
- ❌ Duplicar toast error em catch de mutation (o `QueryClient` global já faz).
- ❌ `document.querySelector(...)` fora de hooks específicos — React/React Query lida com estado.
- ❌ Esconder focus ring (`focus:outline-none` sem `focus-visible:ring-*` substituto).
- ❌ Hard-codar strings em português/inglês fora do sistema de i18n.
- ❌ Adicionar uma `<Route>` sem `<SafePage>`.
- ❌ Editar `src/components/ui/*` diretamente (são gerenciados por `npx shadcn add`).

---

## 13. Checklist para coding agents

Antes de submeter qualquer PR/commit que toque em UI:

- [ ] Usei **tokens semânticos** (`bg-primary`, `text-muted-foreground`, etc.) em vez de cores literais
- [ ] Testei em **dark mode** (é o default) e em **light mode**
- [ ] Componentes interativos têm **focus ring visível**
- [ ] Animações usam **classes `.animate-*`**, não `style={{}}`
- [ ] Respeitei **`prefers-reduced-motion`** (automático se usei as classes)
- [ ] Strings passam por **`useTranslation()`**
- [ ] Rotas novas têm **`<SafePage>`** e foram registradas no `App.tsx`
- [ ] Botões sensíveis têm **`<AccessControl permission="...">`**
- [ ] Usei **shadcn/ui existente** antes de criar componente novo
- [ ] Ícones são **lucide-react**
- [ ] Toasts usam **`sonner`** (`import { toast } from 'sonner'`)
- [ ] Queries/mutations passam por **`@tanstack/react-query`**
- [ ] Mobile: touch targets ≥ 44px e layout responsivo (`sm:`, `lg:`)
- [ ] Nenhum texto hard-coded visível ao usuário

---

## 14. Histórico

| Data | Mudança |
|---|---|
| 2026-04-09 | Versão inicial criada a partir da auditoria dos gaps (`GAP-AGENT P3 #9`). Documenta o estado atual de `tailwind.config.ts` + `src/index.css` sem inventar nada. |

---

*Este documento faz parte do conjunto de docs canônicos do projeto:*

- *`GAP-ANALYSIS-GITHUB-TOPICS-AGENT-2026-04-05.md` — o que o mercado tem que o Nexus não tem*
- *`NEXUS-AUDITORIA-FRONTEND-COVERAGE.md` — cobertura frontend vs backend*
- *`COVERAGE-REPORT.md` — estado da rede de testes*
- *`BACKLOG-10-10.md` — roadmap priorizado em 7 WAVEs*
- **`DESIGN.md` — este arquivo: design system canônico**
