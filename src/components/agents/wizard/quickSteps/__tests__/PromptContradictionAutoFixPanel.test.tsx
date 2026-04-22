/**
 * Integration test for the auto-fix panel: simulates a prompt editor that owns
 * the prompt state, mounts the panel, and asserts that clicking "Aplicar" on
 * a detected contradiction propagates a fixed prompt back to the parent and
 * clears the panel from the screen.
 */
import { describe, it, expect } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { PromptContradictionAutoFixPanel } from '../PromptContradictionAutoFixPanel';
import { countContradictions } from '@/lib/validations/promptContradictions';

const CONFLICTING_PROMPT = [
  'Você é um agente de suporte.',
  '- Sempre confirme o pedido do cliente.',
  '- Nunca confirme o pedido do cliente.',
].join('\n');

/** Minimal host that mirrors how the wizard wires the panel to a prompt editor. */
function Host({ initial }: { initial: string }) {
  const [prompt, setPrompt] = useState(initial);
  const [lastSummary, setLastSummary] = useState<string>('');
  return (
    <div>
      <textarea data-testid="prompt-editor" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
      <p data-testid="last-summary">{lastSummary}</p>
      <p data-testid="conflict-count">{countContradictions(prompt)}</p>
      <PromptContradictionAutoFixPanel
        prompt={prompt}
        onApply={(fixed, summary) => {
          setPrompt(fixed);
          setLastSummary(summary);
        }}
      />
    </div>
  );
}

describe('PromptContradictionAutoFixPanel', () => {
  it('renders nothing when the prompt has no contradictions', () => {
    const { container } = render(<Host initial="Você é um agente útil." />);
    expect(screen.queryByText(/Corrigir contradições automaticamente/i)).not.toBeInTheDocument();
    // Sanity: the host still rendered.
    expect(container.querySelector('[data-testid="prompt-editor"]')).toBeInTheDocument();
  });

  it('shows a fix row for each detected contradiction', () => {
    render(<Host initial={CONFLICTING_PROMPT} />);
    expect(screen.getByText(/Corrigir contradições automaticamente/i)).toBeInTheDocument();
    // At least one "Aplicar" button is rendered for the detected conflict.
    const applyButtons = screen.getAllByRole('button', { name: /Aplicar correção da contradição/i });
    expect(applyButtons.length).toBeGreaterThan(0);
  });

  it('applies a fix, clears the contradiction, and surfaces the undo banner', () => {
    render(<Host initial={CONFLICTING_PROMPT} />);
    expect(screen.getByTestId('conflict-count').textContent).not.toBe('0');

    const applyBtn = screen.getAllByRole('button', { name: /Aplicar correção da contradição/i })[0];
    fireEvent.click(applyBtn);

    // Conflict count dropped to zero — the editor received the fixed prompt.
    expect(screen.getByTestId('conflict-count').textContent).toBe('0');
    // Summary toast string was forwarded to the parent.
    expect(screen.getByTestId('last-summary').textContent).toMatch(/Contradição.*resolvida/i);
    // Fix list is gone, but the undo banner is now visible.
    expect(screen.queryByText(/Corrigir contradições automaticamente/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Última correção de contradição aplicada/i)).toBeInTheDocument();
  });

  it('undoes the last applied fix, restoring the original prompt', () => {
    render(<Host initial={CONFLICTING_PROMPT} />);
    fireEvent.click(screen.getAllByRole('button', { name: /Aplicar correção da contradição/i })[0]);
    expect(screen.getByTestId('conflict-count').textContent).toBe('0');

    const undoBtn = screen.getByRole('button', { name: /Desfazer a última aplicação/i });
    fireEvent.click(undoBtn);

    // Original conflicts are back; the panel is rendered again.
    expect(screen.getByTestId('conflict-count').textContent).not.toBe('0');
    expect(screen.getByText(/Corrigir contradições automaticamente/i)).toBeInTheDocument();
    expect(screen.getByTestId('last-summary').textContent).toMatch(/^Desfeito:/);
  });

  it('opens the preview dialog with the word-level diff when "Prévia" is clicked', () => {
    render(<Host initial={CONFLICTING_PROMPT} />);
    const previewBtn = screen.getAllByRole('button', { name: /Pré-visualizar correção/i })[0];
    fireEvent.click(previewBtn);

    // Dialog title from the panel.
    const dialog = screen.getByRole('alertdialog');
    expect(within(dialog).getByText(/Unificar regras/i)).toBeInTheDocument();
    // Word-diff legend (tokens added/removed) is the signature of ContradictionWordDiff.
    expect(within(dialog).getByText(/token.*removido/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/token.*adicionado/i)).toBeInTheDocument();
  });
});
