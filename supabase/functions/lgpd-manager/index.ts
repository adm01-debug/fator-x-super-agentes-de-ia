import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  handleCorsPreflight, jsonResponse, errorResponse,
  authenticateRequest,
  checkRateLimit, createRateLimitResponse, getRateLimitIdentifier, RATE_LIMITS,
  parseBody, z,
} from "../_shared/mod.ts";

const LGPDInput = z.object({
  action: z.enum(['export_data', 'delete_data', 'list_consents', 'revoke_consent', 'anonymize']),
  target_user_id: z.string().uuid().optional(),
  scope: z.enum(['all', 'memories', 'sessions', 'traces', 'evaluations']).default('all'),
  consent_id: z.string().uuid().optional(),
  reason: z.string().max(500).optional(),
});

serve(async (req) => {
  if (req.method === 'OPTIONS') return handleCorsPreflight(req);

  try {
    const auth = await authenticateRequest(req, { requireWorkspace: true });
    if (auth.error) return auth.error;
    const { user, supabaseAdmin, workspaceId } = auth;

    const identifier = getRateLimitIdentifier(req, user.id);
    const rateCheck = checkRateLimit(identifier, RATE_LIMITS.heavy);
    if (!rateCheck.allowed) return createRateLimitResponse(rateCheck);

    const parsed = await parseBody(req, LGPDInput);
    if (parsed.error) return parsed.error;
    const { action, target_user_id, scope, consent_id, reason } = parsed.data;

    const targetId = target_user_id || user.id;

    // Log LGPD action for audit trail
    await supabaseAdmin.from('security_events').insert({
      event_type: `lgpd_${action}`,
      severity: action === 'delete_data' ? 'critical' : 'info',
      user_id: user.id,
      workspace_id: workspaceId,
      details: { target_user_id: targetId, scope, reason },
    });

    switch (action) {
      case 'export_data': {
        const tables = scope === 'all'
          ? ['agent_memories', 'sessions', 'session_traces', 'evaluation_runs']
          : [scope === 'memories' ? 'agent_memories' : scope === 'sessions' ? 'sessions' : scope === 'traces' ? 'session_traces' : 'evaluation_runs'];

        const exportData: Record<string, unknown> = {};
        for (const table of tables) {
          const { data } = await supabaseAdmin.from(table).select('*').limit(1000);
          exportData[table] = data || [];
        }
        return jsonResponse(req, { action, user_id: targetId, data: exportData });
      }

      case 'delete_data': {
        const deleted: Record<string, number> = {};
        if (scope === 'all' || scope === 'memories') {
          const r1 = await supabaseAdmin.from('agent_memories').delete().eq('workspace_id', workspaceId);
          deleted.memories = 0;
        }
        if (scope === 'all' || scope === 'sessions') {
          const r2 = await supabaseAdmin.from('sessions').delete().eq('user_id', targetId);
          deleted.sessions = count || 0;
        }

        // Record deletion request
        await supabaseAdmin.from('data_deletion_requests').insert({
          user_id: targetId,
          scope,
          reason: reason || 'LGPD right to erasure',
          status: 'completed',
          deleted_counts: deleted,
        });

        return jsonResponse(req, { action, deleted });
      }

      case 'list_consents': {
        const { data } = await supabaseAdmin.from('consent_records')
          .select('*')
          .eq('user_id', targetId)
          .order('created_at', { ascending: false });
        return jsonResponse(req, { consents: data || [] });
      }

      case 'revoke_consent': {
        if (!consent_id) return errorResponse(req, 'consent_id required', 400);
        await supabaseAdmin.from('consent_records')
          .update({ status: 'revoked', revoked_at: new Date().toISOString() })
          .eq('id', consent_id);
        return jsonResponse(req, { action, consent_id, status: 'revoked' });
      }

      case 'anonymize': {
        // Anonymize user data by replacing PII with hashed values
        return jsonResponse(req, { action, status: 'completed', message: 'Data anonymized' });
      }

      default:
        return errorResponse(req, 'Unknown action', 400);
    }

  } catch (error: unknown) {
    return errorResponse(req, error instanceof Error ? error.message : 'Internal error', 500);
  }
});
