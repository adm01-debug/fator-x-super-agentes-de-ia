import { describe, it, expect, vi, beforeEach } from 'vitest';
import { hasPermission, type PermissionKey } from '@/services/rbacService';

describe('RBAC hasPermission', () => {
  const userPerms = new Set<PermissionKey>([
    'agents.create', 'agents.read', 'agents.update',
    'workflows.read', 'knowledge.read',
  ]);

  it('returns true for single permission the user has', () => {
    expect(hasPermission(userPerms, 'agents.create')).toBe(true);
  });

  it('returns false for single permission the user does NOT have', () => {
    expect(hasPermission(userPerms, 'agents.delete')).toBe(false);
  });

  it('returns true when user has ANY of multiple permissions', () => {
    expect(hasPermission(userPerms, ['agents.delete', 'agents.create'], 'any')).toBe(true);
  });

  it('returns false when user has NONE of multiple permissions', () => {
    expect(hasPermission(userPerms, ['agents.delete', 'agents.deploy'], 'any')).toBe(false);
  });

  it('returns true when user has ALL of multiple permissions', () => {
    expect(hasPermission(userPerms, ['agents.create', 'agents.read'], 'all')).toBe(true);
  });

  it('returns false when user is missing one of ALL required', () => {
    expect(hasPermission(userPerms, ['agents.create', 'agents.delete'], 'all')).toBe(false);
  });

  it('returns false for empty permission set', () => {
    expect(hasPermission(new Set(), 'agents.create')).toBe(false);
  });
});
