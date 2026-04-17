/**
 * ═══════════════════════════════════════════════════════════════
 * RLS Persona Tests — Cross-Tenant Isolation
 * ═══════════════════════════════════════════════════════════════
 * Validates that Row-Level Security policies prevent data leakage
 * across users/workspaces and that sensitive tables (secrets,
 * audit_log, api_keys) cannot be read directly.
 *
 * Opt-in: requires SUPABASE_SERVICE_ROLE_KEY in env.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  RLS_TESTS_ENABLED,
  RLS_SKIP_REASON,
  createTestUser,
  deleteTestUser,
  getServiceClient,
  type TestUser,
} from './setup';

const d = RLS_TESTS_ENABLED ? describe : describe.skip;

if (!RLS_TESTS_ENABLED) {
  // eslint-disable-next-line no-console
  console.warn(`⚠️  ${RLS_SKIP_REASON}`);
}

d('RLS Personas — cross-tenant isolation', () => {
  let alice: TestUser;
  let bob: TestUser;
  let aliceWorkspaceId: string;
  let aliceAgentId: string;

  beforeAll(async () => {
    alice = await createTestUser('alice');
    bob = await createTestUser('bob');

    // Wait for handle_new_user trigger to provision Alice's workspace.
    const service = getServiceClient();
    for (let i = 0; i < 10; i++) {
      const { data } = await service
        .from('workspaces')
        .select('id')
        .eq('owner_id', alice.id)
        .maybeSingle();
      if (data?.id) {
        aliceWorkspaceId = data.id as string;
        break;
      }
      await new Promise((r) => setTimeout(r, 250));
    }
    expect(aliceWorkspaceId, 'Alice workspace must be provisioned').toBeTruthy();

    // Alice creates an agent in her workspace.
    const { data: agent, error } = await alice.client
      .from('agents')
      .insert({
        name: 'alice-agent',
        user_id: alice.id,
        workspace_id: aliceWorkspaceId,
        config: {},
      })
      .select('id')
      .single();
    expect(error, `Alice should create her own agent: ${error?.message}`).toBeNull();
    aliceAgentId = (agent as { id: string }).id;
  }, 30_000);

  afterAll(async () => {
    if (alice?.id) await deleteTestUser(alice.id);
    if (bob?.id) await deleteTestUser(bob.id);
  });

  it('agents — Bob cannot SELECT Alice agents', async () => {
    const { data, error } = await bob.client
      .from('agents')
      .select('id')
      .eq('id', aliceAgentId);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it('agents — Bob cannot UPDATE Alice agent', async () => {
    const { data, error } = await bob.client
      .from('agents')
      .update({ name: 'pwned' })
      .eq('id', aliceAgentId)
      .select('id');
    // Either RLS blocks (error) or rows returned is 0 (silent no-op).
    expect(error !== null || (data ?? []).length === 0).toBe(true);
  });

  it('agents — Bob cannot DELETE Alice agent', async () => {
    const { data, error } = await bob.client
      .from('agents')
      .delete()
      .eq('id', aliceAgentId)
      .select('id');
    expect(error !== null || (data ?? []).length === 0).toBe(true);

    // Confirm via service role that the agent still exists.
    const { data: stillThere } = await getServiceClient()
      .from('agents')
      .select('id')
      .eq('id', aliceAgentId)
      .maybeSingle();
    expect(stillThere?.id).toBe(aliceAgentId);
  });

  it('workspace_secrets — direct SELECT is blocked for everyone', async () => {
    const { data: aliceData } = await alice.client.from('workspace_secrets').select('*').limit(1);
    const { data: bobData } = await bob.client.from('workspace_secrets').select('*').limit(1);
    expect(aliceData ?? []).toHaveLength(0);
    expect(bobData ?? []).toHaveLength(0);
  });

  it('workspace_secrets — get_masked_secrets RPC works for owner only', async () => {
    const { data: aliceMasked, error: aliceErr } = await alice.client.rpc('get_masked_secrets', {
      p_workspace_id: aliceWorkspaceId,
    });
    expect(aliceErr).toBeNull();
    expect(Array.isArray(aliceMasked)).toBe(true);

    const { data: bobMasked } = await bob.client.rpc('get_masked_secrets', {
      p_workspace_id: aliceWorkspaceId,
    });
    expect(bobMasked ?? []).toHaveLength(0);
  });

  it('audit_log — direct INSERT is blocked, RPC log_audit_entry works', async () => {
    const { error: directErr } = await alice.client.from('audit_log').insert({
      user_id: alice.id,
      action: 'rls.test.direct',
      entity_type: 'test',
    });
    expect(directErr).not.toBeNull();

    const { error: rpcErr } = await alice.client.rpc('log_audit_entry', {
      p_action: 'rls.test.rpc',
      p_entity_type: 'test',
      p_entity_id: null,
      p_metadata: { source: 'rls-suite' },
    });
    expect(rpcErr).toBeNull();
  });

  it('api_keys — Bob cannot read Alice key_hash', async () => {
    const service = getServiceClient();
    const { data: inserted } = await service
      .from('api_keys')
      .insert({
        user_id: alice.id,
        workspace_id: aliceWorkspaceId,
        name: 'rls-test-key',
        key_prefix: 'sk_test_',
        key_hash: 'fake-sha256-hash-for-rls-test',
      })
      .select('id')
      .single();
    expect(inserted?.id).toBeTruthy();

    const { data: bobView } = await bob.client.from('api_keys').select('*').eq('id', inserted!.id);
    expect(bobView ?? []).toHaveLength(0);

    // Cleanup
    await service.from('api_keys').delete().eq('id', inserted!.id);
  });

  it('workspace_members — non-members get nothing', async () => {
    const { data } = await bob.client
      .from('workspace_members')
      .select('*')
      .eq('workspace_id', aliceWorkspaceId);
    expect(data ?? []).toHaveLength(0);
  });
});
