/**
 * Nexus Agents Studio — Teams Service
 * Workspace member management, invitations.
 */
import { supabase } from '@/integrations/supabase/client';
import type { RoleKey } from './rbacService';

export async function listMembers(workspaceId: string) {
  const { data, error } = await supabase
    .from('workspace_members_safe')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('invited_at', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function inviteMember(workspaceId: string, email: string, role: RoleKey = 'agent_viewer') {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Check if member already exists
  const { data: existing } = await supabase
    .from('workspace_members')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('email', email)
    .limit(1);

  if (existing && existing.length > 0) {
    throw new Error(`Member with email ${email} already exists in this workspace`);
  }

  // Insert as pending invitation (no user_id yet — assigned on accept)
  const { error } = await supabase.from('workspace_members').insert({
    workspace_id: workspaceId,
    email,
    role,
    user_id: crypto.randomUUID(), // placeholder until invitation is accepted
  });

  if (error) throw error;
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

export async function getPendingInvites(email: string) {
  const { data, error } = await supabase
    .from('workspace_members')
    .select('*')
    .eq('email', email)
    .is('accepted_at', null)
    .is('user_id', null);
  if (error) throw error;
  return data ?? [];
}

export async function acceptInvite(memberId: string) {
  const { error } = await supabase.rpc('accept_workspace_invitation', { p_member_id: memberId });
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

export async function insertWorkspaceMember(member: { workspace_id: string; email: string; role: string; name?: string; user_id?: string }) {
  // user_id is required by DB; for pending invitations use a deterministic UUID based on email
  const userId = member.user_id ?? crypto.randomUUID();
  const { error } = await supabase.from('workspace_members').insert({
    ...member,
    user_id: userId,
  });
  if (error) throw error;
}
