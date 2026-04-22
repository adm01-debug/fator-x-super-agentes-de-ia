/**
 * Sobe pelo DOM a partir de `el` e expande qualquer ancestral que esteja
 * em estado colapsado (Radix Collapsible / Accordion / Tabs do shadcn).
 *
 * Estratégia (independente de biblioteca):
 *  1. Procura ancestrais com `data-state="closed"` — convenção do Radix
 *     usada por Collapsible, Accordion e Dialog.
 *  2. Para cada um, tenta achar o trigger correspondente:
 *     - Mesmo container, descendente com `[data-state="closed"][role="button"]`.
 *     - Ou irmão imediato anterior com `data-state="closed"`.
 *     - Ou via `aria-controls` apontando para o id do conteúdo.
 *  3. Para Tabs, procura a TabsList ancestral e clica no trigger cujo
 *     `data-state="inactive"` corresponde ao `value` do TabsContent.
 *
 * Retorna `true` quando expandiu pelo menos um container — assim o caller
 * pode aguardar um frame extra antes do scroll/focus para a animação rodar.
 */
export function expandAncestorContainers(el: HTMLElement | null): boolean {
  if (!el) return false;
  let changed = false;
  // Coletamos antes de clicar — clicar muda o DOM e quebraria o walk.
  const targets: HTMLElement[] = [];
  let cur: HTMLElement | null = el.parentElement;
  while (cur && cur !== document.body) {
    // Radix Collapsible/Accordion content fechado expõe data-state="closed".
    if (cur.getAttribute('data-state') === 'closed') {
      targets.push(cur);
    }
    // TabsContent inativo: data-state="inactive" + role="tabpanel".
    if (
      cur.getAttribute('role') === 'tabpanel' &&
      cur.getAttribute('data-state') === 'inactive'
    ) {
      targets.push(cur);
    }
    cur = cur.parentElement;
  }

  // Processa de fora para dentro — abre o ancestral mais externo primeiro,
  // garantindo que o trigger interno esteja visível para o próximo passo.
  for (const node of targets.reverse()) {
    const trigger = findTriggerFor(node);
    if (trigger) {
      trigger.click();
      changed = true;
    }
  }
  return changed;
}

function findTriggerFor(content: HTMLElement): HTMLElement | null {
  // 1. aria-controls aponta diretamente para o id do conteúdo.
  if (content.id) {
    const byAria = document.querySelector<HTMLElement>(
      `[aria-controls="${CSS.escape(content.id)}"]`,
    );
    if (byAria) return byAria;
  }

  // 2. Tabs: encontra a TabsList ancestral e o trigger com mesmo `value`.
  if (content.getAttribute('role') === 'tabpanel') {
    const value = content.getAttribute('data-value') ?? content.getAttribute('value');
    // Radix Tabs usa data-state="inactive" no TabsContent e mesma key no trigger.
    const tabsRoot = content.closest('[role="tablist"]')?.parentElement
      ?? content.parentElement?.querySelector('[role="tablist"]')?.parentElement;
    const list = tabsRoot?.querySelector<HTMLElement>('[role="tablist"]');
    if (list && value) {
      const trigger = list.querySelector<HTMLElement>(
        `[role="tab"][data-value="${CSS.escape(value)}"]`,
      );
      if (trigger) return trigger;
    }
  }

  // 3. Irmão imediato anterior: padrão típico do Collapsible (trigger acima do content).
  const prev = content.previousElementSibling as HTMLElement | null;
  if (prev?.getAttribute('data-state') === 'closed') return prev;

  // 4. Trigger dentro do mesmo wrapper pai.
  const parent = content.parentElement;
  if (parent) {
    const trigger = parent.querySelector<HTMLElement>(
      '[data-state="closed"][role="button"], [data-state="closed"] > button',
    );
    if (trigger && trigger !== content) return trigger;
  }

  return null;
}
