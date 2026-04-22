import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RestoreFeedbackBanner, type RestoreFeedbackInfo } from '../RestoreFeedbackBanner';

/**
 * Garante que o foco/navegação por teclado durante a retomada de rascunho
 * leve o usuário até o primeiro campo inválido sem precisar de mouse.
 *
 * O banner é a porta de entrada visual: ao montar, o CTA "Corrigir agora"
 * deve receber foco automático (autoFocus) e ser acionável por Enter/Espaço.
 * Tab deve mover para "Dispensar"; Shift+Tab deve voltar — assim usuários
 * de teclado conseguem completar o fluxo de correção sem armadilhas.
 */

const baseInfo: RestoreFeedbackInfo = {
  stepIdx: 0,
  field: 'mission',
  fieldLabel: 'Missão',
  errorType: 'required',
  errorMessage: 'Missão é obrigatória',
  stepLabel: 'Identidade',
  mode: 'full',
};

describe('RestoreFeedbackBanner — navegação por teclado', () => {
  it('foca automaticamente o botão "Corrigir agora" ao montar', () => {
    render(
      <RestoreFeedbackBanner info={baseInfo} onJumpToField={vi.fn()} onDismiss={vi.fn()} />,
    );
    const fixBtn = screen.getByRole('button', { name: /corrigir agora/i });
    expect(fixBtn).toHaveFocus();
  });

  it('aciona onJumpToField ao pressionar Enter no CTA focado', async () => {
    const onJumpToField = vi.fn();
    const user = userEvent.setup();
    render(
      <RestoreFeedbackBanner info={baseInfo} onJumpToField={onJumpToField} onDismiss={vi.fn()} />,
    );
    // CTA já tem autoFocus — basta pressionar Enter.
    await user.keyboard('{Enter}');
    expect(onJumpToField).toHaveBeenCalledTimes(1);
  });

  it('aciona onJumpToField ao pressionar Espaço no CTA focado', async () => {
    const onJumpToField = vi.fn();
    const user = userEvent.setup();
    render(
      <RestoreFeedbackBanner info={baseInfo} onJumpToField={onJumpToField} onDismiss={vi.fn()} />,
    );
    await user.keyboard(' ');
    expect(onJumpToField).toHaveBeenCalledTimes(1);
  });

  it('Tab move o foco para "Dispensar" e Shift+Tab retorna ao CTA', async () => {
    const user = userEvent.setup();
    render(
      <RestoreFeedbackBanner info={baseInfo} onJumpToField={vi.fn()} onDismiss={vi.fn()} />,
    );
    const fixBtn = screen.getByRole('button', { name: /corrigir agora/i });
    const dismissBtn = screen.getByRole('button', { name: /dispensar resumo do erro/i });

    expect(fixBtn).toHaveFocus();
    await user.tab();
    expect(dismissBtn).toHaveFocus();
    await user.tab({ shift: true });
    expect(fixBtn).toHaveFocus();
  });

  it('Enter no botão "Dispensar" chama onDismiss (não confunde com CTA)', async () => {
    const onJumpToField = vi.fn();
    const onDismiss = vi.fn();
    const user = userEvent.setup();
    render(
      <RestoreFeedbackBanner info={baseInfo} onJumpToField={onJumpToField} onDismiss={onDismiss} />,
    );
    await user.tab(); // CTA → Dispensar
    await user.keyboard('{Enter}');
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onJumpToField).not.toHaveBeenCalled();
  });

  it('exibe rótulo legível do campo, tipo do erro e passo para leitores de tela', () => {
    render(
      <RestoreFeedbackBanner info={baseInfo} onJumpToField={vi.fn()} onDismiss={vi.fn()} />,
    );
    // role=status garante anúncio em screen readers ao montar.
    const status = screen.getByRole('status');
    expect(status).toBeInTheDocument();
    expect(status.textContent).toMatch(/Missão/);
    expect(status.textContent).toMatch(/Campo obrigatório/);
    expect(status.textContent).toMatch(/passo Identidade/);
  });
});
