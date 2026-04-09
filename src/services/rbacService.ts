/**
 * ═══════════════════════════════════════════════════════════════
 * Nexus Agents Studio — RBAC Service
 * ═══════════════════════════════════════════════════════════════
 * Data access layer for roles, permissions, and user role management.
 */

import { fromTable } from '@/lib/supabaseExtended';

// ═══ Types ═══

export interface Role {
  id: string;
  key: string;
  name: string;
  description: string | null;
  level: number;
  color: string;
  icon: string;
  is_system: boolean;
  is_active: boolean;
}

export interface Permission {
  id: string;
  key: string;
  name: string;
  description: string | null;
  module: string;
  category: string | null;
  is_system: boolean;
}

export interface UserRole {
  id: string;
  user_id: string;
  role_key: string;
  workspace_id: string;
  assigned_by: string | null;
  created_at: string;
}

export interface UserRoleWithDetails extends UserRole {
  role: Role;
}

export type PermissionKey =
  | 'agents.create' | 'agents.read' | 'agents.update' | 'agents.delete' | 'agents.deploy' | 'agents.test'
  | 'workflows.create' | 'workflows.read' | 'workflows.update' | 'workflows.delete' | 'workflows.execute'
  | 'knowledge.read' | 'knowledge.write' | 'knowledge.delete' | 'knowledge.manage'
  | 'oracle.query' | 'oracle.configure' | 'oracle.history' | 'oracle.write'
  | 'datahub.read' | 'datahub.write' | 'datahub.connections'
  | 'team.read' | 'team.invite' | 'team.remove' | 'team.roles'
  | 'settings.read' | 'settings.write' | 'settings.api_keys' | 'settings.billing'
  | 'monitoring.read' | 'monitoring.traces' | 'monitoring.audit'
  | 'tools.read' | 'tools.write'
  | 'integrations.read' | 'integrations.write';

export type RoleKey = 'workspace_admin' | 'agent_editor' | 'agent_viewer' | 'operator' | 'auditor';

// ═══ Roles ═══

export async function listRoles(): Promise<Role[]> {
  const { data, error } = await fromTable('roles')
    .select('*')
    .eq('is_active', true)
    .order('level', { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as Role[];
}

// ═══ Permissions ═══

export async function listPermissions(): Promise<Permission[]> {
  const { data, error } = await fromTable('permissions')
    .select('*')
    .order('module', { ascending: true });

  if (error) throw error;
  return (data ?? []) as unknown as Permission[];
}

export async function getPermissionsForRole(roleKey: string): Promise<Permission[]> {
  const roleResult = await fromTable('roles').select('id').eq('key', roleKey).single();
  const roleId = (roleResult.data as Record<string, unknown> | null)?.id ?? '';

  const { data, error } = await fromTable('role_permissions')
    .select('permission_id')
    .eq('role_id', roleId);

  if (error) throw error;

  // Fetch permissions by IDs
  const permIds = (data ?? []).map((rp: Record<string, unknown>) => String(rp.permission_id));
  if (permIds.length === 0) return [];

  const { data: perms } = await fromTable('permissions').select('*').in('id', permIds);
  return (perms ?? []) as unknown as Permission[];
}

// ═══ User Roles ═══

export async function getUserRole(userId: string, workspaceId: string): Promise<UserRole | null> {
  const { data, error } = await fromTable('user_roles')
    .select('*')
    .eq('user_id', userId)
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (error) throw error;
  return data as unknown as UserRole | null;
}

export async function getUserPermissions(userId: string, workspaceId: string): Promise<Set<PermissionKey>> {
  const userRole = await getUserRole(userId, workspaceId);
  if (!userRole) return new Set();

  const roleResult = await fromTable('roles').select('id').eq('key', userRole.role_key).single();
  const roleId = (roleResult.data as Record<string, unknown> | null)?.id ?? '';

  const { data, error } = await fromTable('role_permissions')
    .select('permission_id')
    .eq('role_id', roleId);

  if (error) throw error;

  const permIds = (data ?? []).map((rp: Record<string, unknown>) => String(rp.permission_id));
  if (permIds.length === 0) return new Set();

  const { data: perms } = await fromTable('permissions').select('key').in('id', permIds);
  const permissions = new Set<PermissionKey>();
  ((perms ?? []) as Array<Record<string, unknown>>).forEach(p => {
    if (p.key) permissions.add(String(p.key) as PermissionKey);
  });

  return permissions;
}

export async function assignRole(
  userId: string,
  roleKey: RoleKey,
  workspaceId: string,
  assignedBy: string
): Promise<UserRole> {
  const { data, error } = await fromTable('user_roles')
    .upsert({
      user_id: userId,
      role_key: roleKey,
      workspace_id: workspaceId,
      assigned_by: assignedBy,
    }, { onConflict: 'user_id,workspace_id' })
    .select()
    .single();

  if (error) throw error;
  return data as unknown as UserRole;
}

export async function removeRole(userId: string, workspaceId: string): Promise<void> {
  const { error } = await fromTable('user_roles')
    .delete()
    .eq('user_id', userId)
    .eq('workspace_id', workspaceId);

  if (error) throw error;
}

export async function listWorkspaceMembers(workspaceId: string) {
  const { data, error } = await fromTable('user_roles')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

// ═══ Permission Check (client-side) ═══

export function hasPermission(
  userPermissions: Set<PermissionKey>,
  required: PermissionKey | PermissionKey[],
  mode: 'any' | 'all' = 'any'
): boolean {
  const requiredList = Array.isArray(required) ? required : [required];

  if (mode === 'all') {
    return requiredList.every(p => userPermissions.has(p));
  }
  return requiredList.some(p => userPermissions.has(p));
}
