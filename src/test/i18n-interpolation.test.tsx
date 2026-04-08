/**
 * I18nProvider interpolation tests (T20.4)
 *
 * Verifies that the t() function from I18nProvider correctly substitutes
 * {placeholder} tokens with values from the vars object.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nProvider, useI18nContext } from '@/i18n/I18nProvider';

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

function Probe({ tKey, vars }: { tKey: string; vars?: Record<string, string | number> }) {
  const { t } = useI18nContext();
  return <span data-testid="result">{t(tKey, vars)}</span>;
}

describe('I18nProvider interpolation', () => {
  it('substitutes a single {n} placeholder', () => {
    render(
      <I18nProvider>
        <Probe tKey="time.seconds_ago" vars={{ n: 42 }} />
      </I18nProvider>
    );
    expect(screen.getByTestId('result').textContent).toBe('42s atrás');
  });

  it('substitutes multiple placeholders', () => {
    render(
      <I18nProvider>
        <Probe tKey="oracle.partial_complete" vars={{ ok: 2, total: 3 }} />
      </I18nProvider>
    );
    expect(screen.getByTestId('result').textContent).toBe('2/3 modos completaram');
  });

  it('returns key when no translation exists', () => {
    render(
      <I18nProvider>
        <Probe tKey="nonexistent.key" />
      </I18nProvider>
    );
    expect(screen.getByTestId('result').textContent).toBe('nonexistent.key');
  });

  it('leaves placeholder intact when var is missing', () => {
    render(
      <I18nProvider>
        <Probe tKey="time.seconds_ago" vars={{ other: 1 }} />
      </I18nProvider>
    );
    expect(screen.getByTestId('result').textContent).toBe('{n}s atrás');
  });

  it('returns translation as-is when no vars passed', () => {
    render(
      <I18nProvider>
        <Probe tKey="action.save" />
      </I18nProvider>
    );
    expect(screen.getByTestId('result').textContent).toBe('Salvar');
  });

  it('handles validation.min_length with numeric var', () => {
    render(
      <I18nProvider>
        <Probe tKey="validation.min_length" vars={{ n: 8 }} />
      </I18nProvider>
    );
    expect(screen.getByTestId('result').textContent).toBe('Mínimo de 8 caracteres');
  });
});
