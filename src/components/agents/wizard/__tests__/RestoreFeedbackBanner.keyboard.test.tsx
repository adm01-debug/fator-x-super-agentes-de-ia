import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RestoreFeedbackBanner, type RestoreFeedbackInfo } from '../RestoreFeedbackBanner';

/**
 * Testes de navegação por teclado no RestoreFeedbackBanner.
 *
 * Cobre cenários extremos:
 *  - Banner completo (3 ações): Tab cicla na ordem visual; Shift+Tab volta.
 *  - Banner mínimo (só "Ir ao campo" + "Dispensar"): ainda mantém ciclo
 *    consistente — sem botões "fantasma" focáveis.
 *  - Modo mobile (viewport 360px + matchMedia mockado): a ordem de Tab e os
 *    elementos focáveis permanecem os mesmos — flex-wrap não muda o tabindex.
 *  - Acessibilidade: todos os botões expõem aria-label descritivo, e o
 *    botão de dispensar é alcançável por teclado mesmo no modo mínimo.
 */

const baseInfo: RestoreFeedbackInfo = {
  field: 'mission',
  fieldLabel: 'Missão',
  stepIdx: 0,
  stepLabel: 'Identidade',
  errorType: 'too_small',
  errorMessage: 'Descreva em pelo menos 20 caracteres.',
  mode: 'full',
};

function getActionGroup() {
  // O grupo de botões tem aria-label="Ações de restauração" — usamos isso
  // como escopo para isolar os botões do banner do resto do DOM.
  const group = screen.getByRole('group', { name: /ações de restauração/i });
  return within(group);
}

function tabOrder(): string[] {
  // Coleta o aria-label do elemento ativo após cada Tab — útil para
  // verificar a ordem real percorrida pelo teclado.
  const active = document.activeElement as HTMLElement | null;
  return active?.getAttribute('aria-label')?.split(':')[0]?.trim() ? [active.getAttribute('aria-label')!] : [];
}

describe('RestoreFeedbackBanner — navegação por teclado', () => {
  beforeEach(() => {
    // matchMedia precisa existir mesmo em jsdom para o `usePrefersReducedMotion`
    // de qualquer descendente futuro — evita exception em ambientes mínimos.
    if (!window.matchMedia) {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation((query: string) => ({
          matches: false,
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });
    }
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('Banner completo (3 ações + dispensar)', () => {
    it('Tab percorre na ordem: Copiar link → Corrigir agora → Ir ao campo → Dispensar', async () => {
      const user = userEvent.setup();
      render(
        <RestoreFeedbackBanner
          info={baseInfo}
          onJumpToField={vi.fn()}
          onDismiss={vi.fn()}
          onCopyDeeplink={vi.fn()}
          onFixNow={vi.fn()}
        />,
      );

      const group = getActionGroup();
      const copy = group.getByRole('button', { name: /copiar link/i });
      const fix = group.getByRole('button', { name: /corrigir agora/i });
      const jump = group.getByRole('button', { name: /ir ao campo/i });
      const dismiss = group.getByRole('button', { name: /dispensar/i });

      // Foca o primeiro botão manualmente — o teste mede ordem relativa.
      copy.focus();
      expect(document.activeElement).toBe(copy);

      await user.tab();
      expect(document.activeElement).toBe(fix);

      await user.tab();
      expect(document.activeElement).toBe(jump);

      await user.tab();
      expect(document.activeElement).toBe(dismiss);
    });

    it('Shift+Tab volta na ordem inversa do banner', async () => {
      const user = userEvent.setup();
      render(
        <RestoreFeedbackBanner
          info={baseInfo}
          onJumpToField={vi.fn()}
          onDismiss={vi.fn()}
          onCopyDeeplink={vi.fn()}
          onFixNow={vi.fn()}
        />,
      );

      const group = getActionGroup();
      const copy = group.getByRole('button', { name: /copiar link/i });
      const fix = group.getByRole('button', { name: /corrigir agora/i });
      const jump = group.getByRole('button', { name: /ir ao campo/i });
      const dismiss = group.getByRole('button', { name: /dispensar/i });

      dismiss.focus();
      expect(document.activeElement).toBe(dismiss);

      await user.tab({ shift: true });
      expect(document.activeElement).toBe(jump);

      await user.tab({ shift: true });
      expect(document.activeElement).toBe(fix);

      await user.tab({ shift: true });
      expect(document.activeElement).toBe(copy);
    });
  });

  describe('Banner mínimo (sem onCopyDeeplink e sem onFixNow)', () => {
    it('mantém ciclo consistente entre apenas 2 botões: Ir ao campo ↔ Dispensar', async () => {
      const user = userEvent.setup();
      render(
        <RestoreFeedbackBanner
          info={baseInfo}
          onJumpToField={vi.fn()}
          onDismiss={vi.fn()}
        />,
      );

      const group = getActionGroup();
      // Não devem existir botões fantasmas para ações ausentes.
      expect(group.queryByRole('button', { name: /copiar link/i })).toBeNull();
      expect(group.queryByRole('button', { name: /corrigir agora/i })).toBeNull();

      const jump = group.getByRole('button', { name: /ir ao campo/i });
      const dismiss = group.getByRole('button', { name: /dispensar/i });

      jump.focus();
      expect(document.activeElement).toBe(jump);

      await user.tab();
      expect(document.activeElement).toBe(dismiss);

      await user.tab({ shift: true });
      expect(document.activeElement).toBe(jump);
    });

    it('Enter no único botão primário dispara onJumpToField', async () => {
      const user = userEvent.setup();
      const onJumpToField = vi.fn();
      render(
        <RestoreFeedbackBanner
          info={baseInfo}
          onJumpToField={onJumpToField}
          onDismiss={vi.fn()}
        />,
      );

      const jump = screen.getByRole('button', { name: /ir ao campo/i });
      jump.focus();
      await user.keyboard('{Enter}');
      expect(onJumpToField).toHaveBeenCalledTimes(1);
    });
  });

  describe('Modo mobile (viewport 360 + matchMedia max-width)', () => {
    beforeEach(() => {
      // Simula viewport mobile e matchMedia respondendo "match" para
      // queries típicas de breakpoint (max-width: 640px = sm).
      Object.defineProperty(window, 'innerWidth', { value: 360, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
      window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: /max-width:\s*\d+px/.test(query),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })) as unknown as typeof window.matchMedia;
    });

    it('ordem de Tab no mobile é idêntica à do desktop (flex-wrap não altera tabindex)', async () => {
      const user = userEvent.setup();
      render(
        <RestoreFeedbackBanner
          info={baseInfo}
          onJumpToField={vi.fn()}
          onDismiss={vi.fn()}
          onCopyDeeplink={vi.fn()}
          onFixNow={vi.fn()}
        />,
      );

      const group = getActionGroup();
      const copy = group.getByRole('button', { name: /copiar link/i });
      const fix = group.getByRole('button', { name: /corrigir agora/i });
      const jump = group.getByRole('button', { name: /ir ao campo/i });
      const dismiss = group.getByRole('button', { name: /dispensar/i });

      copy.focus();
      const visited: HTMLElement[] = [copy];
      for (let i = 0; i < 3; i++) {
        await user.tab();
        visited.push(document.activeElement as HTMLElement);
      }
      // A ordem deve ser: copy → fix → jump → dismiss, mesmo no mobile.
      expect(visited).toEqual([copy, fix, jump, dismiss]);
    });

    it('Shift+Tab no mobile volta sem pular elementos invisíveis (sr-only)', async () => {
      const user = userEvent.setup();
      render(
        <RestoreFeedbackBanner
          info={baseInfo}
          onJumpToField={vi.fn()}
          onDismiss={vi.fn()}
          onCopyDeeplink={vi.fn()}
          onFixNow={vi.fn()}
        />,
      );

      const group = getActionGroup();
      const dismiss = group.getByRole('button', { name: /dispensar/i });
      dismiss.focus();

      // 3 Shift+Tabs devem chegar em "Copiar link" sem aterrissar em
      // nenhuma <span class="sr-only"> (textos descritivos não são focáveis).
      await user.tab({ shift: true });
      await user.tab({ shift: true });
      await user.tab({ shift: true });
      const active = document.activeElement as HTMLElement;
      expect(active.tagName).toBe('BUTTON');
      expect(active.getAttribute('aria-label')).toMatch(/copiar link/i);
    });
  });

  describe('Acessibilidade — atributos do banner', () => {
    it('exposes role=alert + aria-live=assertive na região e aria-label nos botões', () => {
      render(
        <RestoreFeedbackBanner
          info={baseInfo}
          onJumpToField={vi.fn()}
          onDismiss={vi.fn()}
          onCopyDeeplink={vi.fn()}
          onFixNow={vi.fn()}
        />,
      );
      const region = screen.getByRole('alert');
      expect(region).toHaveAttribute('aria-live', 'assertive');
      expect(region).toHaveAttribute('aria-atomic', 'true');

      const group = getActionGroup();
      // Cada botão deve ter aria-label próprio (não só title).
      const buttons = group.getAllByRole('button');
      buttons.forEach((b) => {
        expect(b.getAttribute('aria-label')).toBeTruthy();
      });
    });
  });
});
