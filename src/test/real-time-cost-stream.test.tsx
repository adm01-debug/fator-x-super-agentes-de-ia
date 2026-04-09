/**
 * RealTimeCostStream tests (T20.3)
 *
 * Mocks the supabase client so realtime never actually runs, then verifies:
 *  - initial render (waiting state)
 *  - pause/resume toggle
 *  - clear button disabled when empty
 *  - connection state badge transitions
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

let _capturedSubscribeCallback: ((status: string) => void) | null = null;

vi.mock('@/integrations/supabase/client', () => {
  const channel = {
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn((cb: (status: string) => void) => {
      capturedSubscribeCallback = cb;
      return channel;
    }),
  };
  return {
    supabase: {
      channel: vi.fn(() => channel),
      removeChannel: vi.fn(),
    },
  };
});

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { RealTimeCostStream } from '@/components/billing/RealTimeCostStream';

describe('RealTimeCostStream', () => {
  it('renders header, totals and waiting state on mount', () => {
    render(<RealTimeCostStream />);
    expect(screen.getByText(/Stream em tempo real/i)).toBeInTheDocument();
    expect(screen.getByText(/Custo \(sessão\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Aguardando eventos de uso/i)).toBeInTheDocument();
  });

  it('starts with CONECTANDO badge before subscribe callback fires', () => {
    capturedSubscribeCallback = null;
    render(<RealTimeCostStream />);
    expect(screen.getByText('CONECTANDO')).toBeInTheDocument();
  });

  it('pause button toggles label between Pausar and Retomar', () => {
    render(<RealTimeCostStream />);
    const pauseBtn = screen.getByRole('button', { name: /Pausar/i });
    fireEvent.click(pauseBtn);
    expect(screen.getByRole('button', { name: /Retomar/i })).toBeInTheDocument();
    expect(screen.getByText('PAUSADO')).toBeInTheDocument();
  });

  it('clear button is disabled when there are no events', () => {
    render(<RealTimeCostStream />);
    const clearBtn = screen.getByRole('button', { name: /Limpar/i });
    expect(clearBtn).toBeDisabled();
  });

  it('shows zero totals on empty state', () => {
    render(<RealTimeCostStream />);
    // Cost label
    expect(screen.getByText('$0.0000')).toBeInTheDocument();
    // The "Eventos" + "Tokens" cards both show 0
    const zeros = screen.getAllByText('0');
    expect(zeros.length).toBeGreaterThanOrEqual(2);
  });
});
