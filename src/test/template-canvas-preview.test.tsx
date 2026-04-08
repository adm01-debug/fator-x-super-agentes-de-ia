/**
 * TemplateCanvasPreview tests (T20.2)
 *
 * Verifies the SVG mini-map normalises positions correctly, draws edges
 * for valid pairs, and handles edge cases (empty nodes, missing edge
 * endpoints).
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { TemplateCanvasPreview } from '@/components/workflows/TemplateCanvasPreview';

const sampleNodes = [
  { id: 'n1', type: 'trigger', position: { x: 50, y: 100 }, data: { label: 'Start' } },
  { id: 'n2', type: 'agent', position: { x: 280, y: 100 }, data: { label: 'Process' } },
  { id: 'n3', type: 'action', position: { x: 510, y: 100 }, data: { label: 'Finish' } },
];

const sampleEdges = [
  { id: 'e1', source: 'n1', target: 'n2' },
  { id: 'e2', source: 'n2', target: 'n3' },
];

describe('TemplateCanvasPreview', () => {
  it('renders an SVG with the right viewBox dimensions', () => {
    const { container } = render(
      <TemplateCanvasPreview nodes={sampleNodes} edges={sampleEdges} />
    );
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    const viewBox = svg!.getAttribute('viewBox');
    expect(viewBox).toMatch(/^0 0 \d+ \d+$/);
  });

  it('renders one rect per node', () => {
    const { container } = render(
      <TemplateCanvasPreview nodes={sampleNodes} edges={sampleEdges} />
    );
    const rects = container.querySelectorAll('svg rect');
    expect(rects.length).toBe(sampleNodes.length);
  });

  it('renders one path per valid edge', () => {
    const { container } = render(
      <TemplateCanvasPreview nodes={sampleNodes} edges={sampleEdges} />
    );
    const paths = container.querySelectorAll('svg path');
    expect(paths.length).toBe(sampleEdges.length);
  });

  it('skips edges whose endpoints do not exist in nodes', () => {
    const badEdges = [
      ...sampleEdges,
      { id: 'orphan', source: 'n1', target: 'n999' }, // n999 not in nodes
    ];
    const { container } = render(
      <TemplateCanvasPreview nodes={sampleNodes} edges={badEdges} />
    );
    const paths = container.querySelectorAll('svg path');
    expect(paths.length).toBe(2); // not 3
  });

  it('shows fallback when nodes array is empty', () => {
    const { container, getByText } = render(
      <TemplateCanvasPreview nodes={[]} edges={[]} />
    );
    expect(container.querySelector('svg')).toBeNull();
    expect(getByText(/Sem nós/)).toBeInTheDocument();
  });

  it('renders node labels (truncated if too long)', () => {
    const longLabel = 'A very long node label that should be truncated';
    const { container } = render(
      <TemplateCanvasPreview
        nodes={[{ id: 'n1', type: 'agent', position: { x: 0, y: 0 }, data: { label: longLabel } }]}
        edges={[]}
      />
    );
    const text = container.querySelector('svg text');
    expect(text?.textContent?.length).toBeLessThanOrEqual(15);
  });

  it('respects custom height prop', () => {
    const { container } = render(
      <TemplateCanvasPreview nodes={sampleNodes} edges={sampleEdges} height={200} />
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.style.height).toBe('200px');
  });

  it('normalises negative positions to positive viewBox', () => {
    const negNodes = [
      { id: 'n1', type: 'trigger', position: { x: -100, y: -50 }, data: { label: 'A' } },
      { id: 'n2', type: 'agent', position: { x: 100, y: 50 }, data: { label: 'B' } },
    ];
    const { container } = render(
      <TemplateCanvasPreview nodes={negNodes} edges={[]} />
    );
    const rects = container.querySelectorAll('svg rect');
    rects.forEach((r) => {
      const x = Number(r.getAttribute('x'));
      const y = Number(r.getAttribute('y'));
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(0);
    });
  });
});
