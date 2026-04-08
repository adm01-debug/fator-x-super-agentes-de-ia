import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { handleCorsPreflight, getCorsHeaders, getRateLimitIdentifier, checkRateLimit, createRateLimitResponse, RATE_LIMITS } from "../_shared/mod.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') return handleCorsPreflight(req);
  const corsHeaders = getCorsHeaders(req);

  const identifier = getRateLimitIdentifier(req);
  const rateCheck = checkRateLimit(identifier, RATE_LIMITS.standard);
  if (!rateCheck.allowed) return createRateLimitResponse(rateCheck, corsHeaders);

  try {
    const body = await req.json();
    const { channel, recipient, subject, message, template_id, template_vars, priority, metadata } = body;

    if (!channel || !recipient || (!message && !template_id)) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: channel, recipient, message or template_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Resolve template
    let finalSubject = subject ?? '';
    let finalMessage = message ?? '';

    if (template_id) {
      const { data: tpl } = await supabase
        .from('notification_templates')
        .select('*')
        .eq('id', template_id)
        .single();

      if (tpl) {
        const vars = template_vars ?? {};
        finalSubject = renderTemplate(tpl.subject_template, vars);
        finalMessage = renderTemplate(tpl.body_template, vars);
      }
    }

    // Send via channel
    let sendResult: { success: boolean; error?: string } = { success: false };

    switch (channel) {
      case 'email':
        sendResult = await sendEmail(finalSubject, finalMessage, recipient);
        break;
      case 'whatsapp':
        sendResult = await sendWhatsApp(finalMessage, recipient);
        break;
      case 'slack':
        sendResult = await sendSlack(finalMessage, recipient);
        break;
      case 'in_app':
        sendResult = { success: true };
        break;
      case 'webhook':
        sendResult = await sendWebhook(finalMessage, recipient, metadata);
        break;
      default:
        sendResult = { success: true }; // Log only for unsupported channels
    }

    // Record notification
    const { data: notification, error: insertError } = await supabase
      .from('notifications')
      .insert({
        channel,
        priority: priority ?? 'normal',
        status: sendResult.success ? 'sent' : 'failed',
        recipient_address: recipient,
        subject: finalSubject,
        body: finalMessage,
        template_id: template_id ?? null,
        template_vars: template_vars ?? {},
        metadata: metadata ?? {},
        sent_at: sendResult.success ? new Date().toISOString() : null,
        failed_at: !sendResult.success ? new Date().toISOString() : null,
        error: sendResult.error ?? null,
        source_type: 'system',
      })
      .select()
      .single();

    if (insertError) throw insertError;

    return new Response(
      JSON.stringify({
        success: sendResult.success,
        notification_id: notification?.id,
        channel,
        error: sendResult.error,
      }),
      { status: sendResult.success ? 200 : 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function renderTemplate(template: string, vars: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_match, path: string) => {
    const parts = path.split('.');
    let value: unknown = vars;
    for (const p of parts) {
      if (value && typeof value === 'object' && p in (value as Record<string, unknown>)) {
        value = (value as Record<string, unknown>)[p];
      } else {
        return `{{${path}}}`;
      }
    }
    return String(value ?? '');
  });
}

async function sendEmail(subject: string, body: string, to: string): Promise<{ success: boolean; error?: string }> {
  // Integration point: connect to SMTP, SendGrid, Resend, etc.
  console.log(`[EMAIL] To: ${to} | Subject: ${subject}`);
  return { success: true };
}

async function sendWhatsApp(message: string, to: string): Promise<{ success: boolean; error?: string }> {
  const apiUrl = Deno.env.get('WHATSAPP_API_URL');
  const apiKey = Deno.env.get('WHATSAPP_API_KEY');
  const instance = Deno.env.get('WHATSAPP_INSTANCE');

  if (!apiUrl || !apiKey) {
    return { success: false, error: 'WhatsApp API not configured' };
  }

  try {
    const resp = await fetch(`${apiUrl}/message/sendText/${instance}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: apiKey },
      body: JSON.stringify({ number: to, text: message }),
    });
    if (!resp.ok) return { success: false, error: `WhatsApp API returned ${resp.status}` };
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'WhatsApp send failed' };
  }
}

async function sendSlack(message: string, channel: string): Promise<{ success: boolean; error?: string }> {
  const token = Deno.env.get('SLACK_BOT_TOKEN');
  if (!token) return { success: false, error: 'Slack token not configured' };

  try {
    const resp = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ channel, text: message }),
    });
    const data = await resp.json();
    if (!data.ok) return { success: false, error: data.error ?? 'Slack send failed' };
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Slack send failed' };
  }
}

async function sendWebhook(message: string, url: string, metadata?: Record<string, unknown>): Promise<{ success: boolean; error?: string }> {
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, ...metadata }),
    });
    if (!resp.ok) return { success: false, error: `Webhook returned ${resp.status}` };
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Webhook failed' };
  }
}
