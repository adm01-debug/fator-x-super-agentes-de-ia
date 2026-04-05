/**
 * Nexus Agents Studio — Teams Service
 * Workspace member management, invitations.
 */
import { supabase } from '@/integrations/supabase/client';
import type { RoleKey } from './rbacService';

export async function listMembers(workspaceId: string) {
  const { data, error } = await supabase
    .from('workspace_members')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('invited_at', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function inviteMember(workspaceId: string, email: string, role: RoleKey = 'agent_viewer') {
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
    .from('workspace_members')
    .update({ role: newRole })
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId);

  if (error) throw error;
}
