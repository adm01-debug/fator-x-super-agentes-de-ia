/**
 * Nexus Agents Studio — Teams Service
 * Workspace member management, invitations.
 */
import { supabaseExternal } from '@/integrations/supabase/externalClient';
import { supabase } from '@/integrations/supabase/client';
import type { RoleKey } from './rbacService';

export async function listMembers(workspaceId: string) {
  const { data, error } = await supabaseExternal
    .from('workspace_members_safe')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('invited_at', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function inviteMember(
  workspaceId: string,
  email: string,
  role: RoleKey = 'agent_viewer',
  name?: string,
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Atomic RPC: creates member + isolated email row, with admin check.
  const { error } = await supabaseExternal.rpc('invite_workspace_member', {
    p_workspace_id: workspaceId,
    p_email: email,
    p_role: role,
    p_name: name ?? null,
    p_user_id: null,
  });
  if (error) throw error;

  return { invited: true, email, role, workspace_id: workspaceId };
}

export async function removeMember(workspaceId: string, userId: string) {
  const { error } = await supabaseExternal
    .from('workspace_members')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId);

  if (error) throw error;
}

export async function getPendingInvites(email: string) {
  // Após o hardening P0, `email` não é mais legível diretamente.
  // RPC valida que o solicitante é dono do email antes de retornar.
  const { data, error } = await supabaseExternal.rpc('get_pending_invites_for_email', {
    _email: email,
  });
  if (error) throw error;
  return data ?? [];
}

export async function acceptInvite(memberId: string) {
  const { error } = await supabaseExternal.rpc('accept_workspace_invitation', { p_member_id: memberId });
  if (error) throw error;
}

export async function updateMemberRole(workspaceId: string, userId: string, newRole: RoleKey) {
  const { error } = await supabaseExternal
    .from('workspace_members')
    .update({ role: newRole })
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId);

  if (error) throw error;
}

export async function insertWorkspaceMember(member: {
  workspace_id: string;
  email: string;
  role: string;
  name?: string;
  user_id?: string;
}) {
  // Delegates to RPC so the email is written to the isolated PII table.
  const { error } = await supabaseExternal.rpc('invite_workspace_member', {
    p_workspace_id: member.workspace_id,
    p_email: member.email,
    p_role: member.role,
    p_name: member.name ?? null,
    p_user_id: member.user_id ?? null,
  });
  if (error) throw error;
}
