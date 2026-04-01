import { describe, it, expect } from 'vitest';
import { NODE_TYPES, TEMPLATES } from '@/pages/WorkflowsPage';

// ═══ NODE_TYPES ═══

describe('NODE_TYPES', () => {
  it('has exactly 8 entries', () => {
    expect(NODE_TYPES).toHaveLength(8);
  });

  it('each entry has required fields', () => {
    for (const nt of NODE_TYPES) {
      expect(nt).toHaveProperty('type');
      expect(nt).toHaveProperty('label');
      expect(nt).toHaveProperty('icon');
      expect(nt).toHaveProperty('color');
      expect(nt).toHaveProperty('desc');
      expect(typeof nt.type).toBe('string');
      expect(typeof nt.label).toBe('string');
      expect(typeof nt.icon).toBe('string');
      expect(typeof nt.color).toBe('string');
      expect(typeof nt.desc).toBe('string');
    }
  });

  it('has unique type identifiers', () => {
    const types = NODE_TYPES.map(nt => nt.type);
    expect(new Set(types).size).toBe(types.length);
  });

  it('contains expected node types', () => {
    const types = NODE_TYPES.map(nt => nt.type);
    expect(types).toContain('planner');
    expect(types).toContain('researcher');
    expect(types).toContain('retriever');
    expect(types).toContain('critic');
    expect(types).toContain('executor');
    expect(types).toContain('validator');
    expect(types).toContain('human');
    expect(types).toContain('router');
  });

  it('each entry has a non-empty description', () => {
    for (const nt of NODE_TYPES) {
      expect(nt.desc.length).toBeGreaterThan(0);
    }
  });
});

// ═══ TEMPLATES ═══

describe('TEMPLATES', () => {
  it('has at least one template', () => {
    expect(TEMPLATES.length).toBeGreaterThanOrEqual(1);
  });

  it('each template has valid structure with nodes and connections', () => {
    for (const tpl of TEMPLATES) {
      expect(tpl).toHaveProperty('id');
      expect(tpl).toHaveProperty('name');
      expect(tpl).toHaveProperty('nodes');
      expect(tpl).toHaveProperty('connections');
      expect(tpl).toHaveProperty('createdAt');
      expect(Array.isArray(tpl.nodes)).toBe(true);
      expect(Array.isArray(tpl.connections)).toBe(true);
      expect(tpl.nodes.length).toBeGreaterThan(0);
    }
  });

  it('each template has unique ID', () => {
    const ids = TEMPLATES.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('no duplicate node IDs within a single template', () => {
    for (const tpl of TEMPLATES) {
      const nodeIds = tpl.nodes.map(n => n.id);
      expect(new Set(nodeIds).size).toBe(nodeIds.length);
    }
  });

  it('all template connections reference valid node IDs', () => {
    for (const tpl of TEMPLATES) {
      const nodeIds = new Set(tpl.nodes.map(n => n.id));
      for (const conn of tpl.connections) {
        expect(nodeIds.has(conn.fromNodeId)).toBe(true);
        expect(nodeIds.has(conn.toNodeId)).toBe(true);
      }
    }
  });

  it('all template node types exist in NODE_TYPES', () => {
    const validTypes = new Set(NODE_TYPES.map(nt => nt.type));
    for (const tpl of TEMPLATES) {
      for (const node of tpl.nodes) {
        expect(validTypes.has(node.type)).toBe(true);
      }
    }
  });

  it('each node has position coordinates (x, y)', () => {
    for (const tpl of TEMPLATES) {
      for (const node of tpl.nodes) {
        expect(typeof node.x).toBe('number');
        expect(typeof node.y).toBe('number');
        expect(node.x).toBeGreaterThanOrEqual(0);
        expect(node.y).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('each connection has unique ID within its template', () => {
    for (const tpl of TEMPLATES) {
      const connIds = tpl.connections.map(c => c.id);
      expect(new Set(connIds).size).toBe(connIds.length);
    }
  });

  it('no self-referencing connections', () => {
    for (const tpl of TEMPLATES) {
      for (const conn of tpl.connections) {
        expect(conn.fromNodeId).not.toBe(conn.toNodeId);
      }
    }
  });
});
