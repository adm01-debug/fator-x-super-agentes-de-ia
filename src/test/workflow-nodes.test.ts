import { describe, it, expect } from 'vitest';
import { NODE_TYPES, NODE_CATEGORIES, NODE_DEFAULTS } from '@/components/workflows/nodes';

describe('Workflow Node Types', () => {
  it('has 12 node types', () => {
    expect(Object.keys(NODE_TYPES).length).toBe(12);
  });

  it('all node types have defaults', () => {
    for (const key of Object.keys(NODE_TYPES)) {
      expect(NODE_DEFAULTS[key as keyof typeof NODE_DEFAULTS]).toBeDefined();
    }
  });

  it('categories cover all nodes', () => {
    const allCategoryNodes = NODE_CATEGORIES.flatMap(c => c.nodes);
    const allNodeTypes = Object.keys(NODE_TYPES);
    expect(allCategoryNodes.sort()).toEqual(allNodeTypes.sort());
  });

  it('each node has label, icon, and color', () => {
    for (const [key, node] of Object.entries(NODE_TYPES)) {
      expect(node.label, `${key} missing label`).toBeTruthy();
      expect(node.icon, `${key} missing icon`).toBeTruthy();
      expect(node.color, `${key} missing color`).toBeTruthy();
    }
  });
});
