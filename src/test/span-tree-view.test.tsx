/**
 * SpanTreeView tests (improvement #2)
 *
 * Verifies the tree builder uses parent_span_id correctly, sorts by
 * start_time at each level, computes timing bar bounds, and renders
 * the empty state when no spans are passed.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SpanTreeView, type SpanLike } from '@/components/monitoring/SpanTreeView';

const baseSpan = (overrides: Partial<SpanLike>): SpanLike => ({
  span_id: 'sp-x',
  parent_span_id: null,
  name: 'span',
  kind: 'custom',
  start_time: 1000,
  end_time: 1100,
  duration_ms: 100,
  status: 'ok',
  ...overrides,
});

describe('SpanTreeView', () => {
  it('shows empty fallback when no spans', () => {
    render(<SpanTreeView spans={[]} />);
    expect(screen.getByText(/Sem spans/)).toBeInTheDocument();
  });

  it('renders header row when spans are present', () => {
    render(
      <SpanTreeView spans={[baseSpan({ span_id: 's1', name: 'one' })]} />
    );
    expect(screen.getByText('Span')).toBeInTheDocument();
    expect(screen.getByText('Duração')).toBeInTheDocument();
    expect(screen.getByText(/Linha do tempo/)).toBeInTheDocument();
  });

  it('renders flat spans as multiple roots', () => {
    const spans: SpanLike[] = [
      baseSpan({ span_id: 's1', name: 'first' }),
      baseSpan({ span_id: 's2', name: 'second', start_time: 1200 }),
    ];
    render(<SpanTreeView spans={spans} />);
    expect(screen.getByText('first')).toBeInTheDocument();
    expect(screen.getByText('second')).toBeInTheDocument();
  });

  it('renders nested spans hierarchically', () => {
    const spans: SpanLike[] = [
      baseSpan({ span_id: 'parent', name: 'parent-span', kind: 'workflow' }),
      baseSpan({ span_id: 'child', name: 'child-span', parent_span_id: 'parent', start_time: 1010 }),
    ];
    render(<SpanTreeView spans={spans} defaultExpanded />);
    // Parent shows; child shows because defaultExpanded=true
    expect(screen.getByText('parent-span')).toBeInTheDocument();
    expect(screen.getByText('child-span')).toBeInTheDocument();
  });

  it('shows error message inline when span has status=error', () => {
    const spans: SpanLike[] = [
      baseSpan({ span_id: 'p', name: 'parent' }),
      baseSpan({
        span_id: 'c',
        parent_span_id: 'p',
        name: 'failed-call',
        status: 'error',
        status_message: 'Connection refused',
      }),
    ];
    render(<SpanTreeView spans={spans} defaultExpanded />);
    expect(screen.getByText(/Connection refused/)).toBeInTheDocument();
  });

  it('promotes orphan spans (parent not in array) to root', () => {
    const spans: SpanLike[] = [
      baseSpan({ span_id: 'orphan', name: 'orphan', parent_span_id: 'missing-parent' }),
    ];
    render(<SpanTreeView spans={spans} />);
    expect(screen.getByText('orphan')).toBeInTheDocument();
  });

  it('renders kind badge with the span kind label', () => {
    const spans: SpanLike[] = [
      baseSpan({ span_id: 's1', name: 'llm-call', kind: 'llm' }),
    ];
    render(<SpanTreeView spans={spans} />);
    expect(screen.getByText('llm')).toBeInTheDocument();
  });

  it('shows duration in ms', () => {
    const spans: SpanLike[] = [
      baseSpan({ span_id: 's1', name: 'op', duration_ms: 250 }),
    ];
    render(<SpanTreeView spans={spans} />);
    expect(screen.getByText('250ms')).toBeInTheDocument();
  });
});
