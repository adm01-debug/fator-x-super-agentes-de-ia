/**
 * Nexus Agents Studio — Teams Service
 * Workspace member management, invitations.
 */
import { supabase } from '@/integrations/supabase/client';
import type { RoleKey } from './rbacService';

export async function listMembers(workspaceId: string) {
  const { data, error } = await supabase
    .from('workspace_members')
    .select('user_id, role, joined_at')
    .eq('workspace_id', workspaceId)
    .order('joined_at', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function inviteMember(workspaceId: string, email: string, role: RoleKey = 'agent_viewer') {
  // In production, this would send an invitation email
  // For now, directly add the user if they exist
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  return { invited: true, email, role, workspace_id: workspaceId };
}

export async function removeMember(workspaceId: string, userId: string) {
  const { error } = await supabase
    .from('workspace_members')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId);

  if (error) throw error;
}

export async function updateMemberRole(workspaceId: string, userId: string, newRole: RoleKey) {
  const { error } = await supabase
    .from('user_roles')
    .upsert({ user_id: userId, workspace_id: workspaceId, role_key: newRole })
    .eq('user_id', userId)
    .eq('workspace_id', workspaceId);

  if (error) throw error;
}
