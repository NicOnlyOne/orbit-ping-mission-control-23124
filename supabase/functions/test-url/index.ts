// deno-lint-ignore-file no-explicit-any
// Edge Function: website monitor with DOWN-only alerts and manual-test cooldown bypass

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

// =========================
// Config (adjust as needed)
// =========================
const COOLDOWN_MINUTES = 60;        // cooldown for automatic checks
const DISABLE_ALERTS = false;       // set true to globally silence emails
const TIMEOUT_MS = 15_000;          // fetch timeout per monitor
const MANUAL_COUNTS_FOR_COOLDOWN = true; // if true, manual send updates last_alert_sent

// IMPORTANT: set these secrets in your project (Dashboard > Edge Functions > Secrets)
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// If you use a different table/columns, update these mappings:
const TABLE_MONITORS = "monitors";
type MonitorRow = {
  id: string;
  name?: string | null;
  url: string;
  enabled?: boolean | null;
  status?: "UP" | "DOWN" | null;          // previous status saved in DB
  last_alert_sent?: string | null;        // ISO timestamp in DB (nullable)
  notify_email?: string | null;           // where to send alerts
  // add any other columns you keep
};

// CORS
const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "cache-control": "no-store",
};

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ===============
// Utility helpers
// ===============
function nowIso(): string {
  return new Date().toISOString();
}

function minutesSince(iso: string): number {
  const then = new Date(iso).getTime();
  return (Date.now() - then) / 60000;
}

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  const t = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)
  );
  return Promise.race([p, t]);
}

// ==================================
// Data access: load & update monitors
// ==================================
async function loadMonitors(targetMonitorId?: string): Promise<MonitorRow[]> {
  if (targetMonitorId) {
    const { data, error } = await supabase
      .from<MonitorRow>(TABLE_MONITORS)
      .select("*")
      .eq("id", targetMonitorId)
      .limit(1);
    if (error) throw error;
    return (data ?? []).filter((m) => !!m);
  }

  // load all enabled monitors
  const { data, error } = await supabase
    .from<MonitorRow>(TABLE_MONITORS)
    .select("*")
    .eq("enabled", true);
  if (error) throw error;
  return data ?? [];
}

async function updateMonitorStatus(id: string, nextStatus: "UP" | "DOWN") {
  const { error } = await supabase
    .from(TABLE_MONITORS)
    .update({ status: nextStatus })
    .eq("id", id);
  if (error) throw error;
}

async function markLastAlertSent(id: string) {
  const { error } = await supabase
    .from(TABLE_MONITORS)
    .update({ last_alert_sent: nowIso() })
    .eq("id", id);
  if (error) throw error;
}

// =====================
// Cooldown + email send
// =====================
async function shouldSendEmailWithCooldown(m: MonitorRow): Promise<boolean> {
  if (!m.last_alert_sent) return true;
  return minutesSince(m.last_alert_sent) >= COOLDOWN_MINUTES;
}

// REAL EMAIL INTEGRATION WITH RESEND
async function invokeSendEmail(args: {
  monitor: MonitorRow;
  type: "DOWN"; // we only send DOWN alerts
  probeResult: { ok: boolean; status?: number; error?: string | null };
}) {
  if (DISABLE_ALERTS) return { ok: true, skipped: true };

  const to = args.monitor.notify_email;
  if (!to) {
    console.warn(`Monitor ${args.monitor.id} has no notify_email; skipping email.`);
    return { ok: false, skipped: true };
  }

  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      console.error('RESEND_API_KEY not found in environment variables');
      return { ok: false, error: 'Missing API key' };
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'onboarding@resend.dev',
        to: [to],
        subject: `🚨 Mission Alert: ${args.monitor.name || args.monitor.url} is DOWN`,
        html: `
          <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
            <div style="background: #1a1a1a; color: white; padding: 24px; text-align: center;">
              <h1 style="margin: 0; font-size: 28px; font-weight: bold;">🛰️ ORBIT PING MISSION CONTROL</h1>
              <p style="margin: 8px 0 0; opacity: 0.8;">Houston, we have a problem!</p>
            </div>
            
            <div style="background: #dc2626; color: white; padding: 20px; text-align: center;">
              <h2 style="margin: 0; font-size: 24px;">🚨 SERVICE DOWN ALERT</h2>
            </div>
            
            <div style="padding: 24px;">
              <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
                <h3 style="margin: 0 0 16px 0; color: #1e293b;">Mission Details</h3>
                <p style="margin: 0 0 8px 0;"><strong>Service Name:</strong> ${args.monitor.name || 'Unnamed Service'}</p>
                <p style="margin: 0 0 8px 0;"><strong>URL:</strong> <a href="${args.monitor.url}" style="color: #dc2626;">${args.monitor.url}</a></p>
                <p style="margin: 0 0 8px 0;"><strong>Status:</strong> <span style="color: #dc2626; font-weight: bold;">DOWN 🔴</span></p>
                ${args.probeResult.status ? `<p style="margin: 0 0 8px 0;"><strong>HTTP Status:</strong> ${args.probeResult.status}</p>` : ''}
                ${args.probeResult.error ? `<p style="margin: 0 0 8px 0;"><strong>Error:</strong> ${args.probeResult.error}</p>` : ''}
                <p style="margin: 0;"><strong>Alert Time:</strong> ${new Date().toLocaleString()}</p>
              </div>
              
              <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
                <p style="margin: 0; color: #991b1b;">
                  ⚠️ <strong>Action Required:</strong> Please check your service immediately. Your website or service is currently unreachable.
                </p>
              </div>
              
              <div style="text-align: center; margin: 24px 0;">
                <a href="${args.monitor.url}" style="background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">CHECK SERVICE NOW</a>
              </div>
            </div>
            
            <div style="background: #f1f5f9; padding: 16px; text-align: center; font-size: 14px; color: #64748b;">
              <p style="margin: 0;">This alert was sent by <strong>Orbit Ping Mission Control</strong> 🚀</p>
              <p style="margin: 4px 0 0 0;">Monitoring your digital universe, one ping at a time.</p>
            </div>
          </div>
        `,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Resend API error:', errorText);
      return { ok: false, error: errorText };
    }

    const result = await response.json();
    console.log('🚀 Email sent successfully:', { to, monitor: args.monitor.name });
    return { ok: true, result };

  } catch (error: any) {
    console.error('❌ Error sending email:', error);
    return { ok: false, error: error.message };
  }
}

// ======
// Probe
// ======
async function probeUrl(url: string): Promise<{ ok: boolean; status?: number; error?: string | null }> {
  try {
    const res = await withTimeout(fetch(url, { redirect: "follow" }), TIMEOUT_MS);
    return { ok: res.ok, status: res.status, error: null };
  } catch (e: any) {
    return { ok: false, status: undefined, error: e?.message ?? String(e) };
  }
}

// =====================
// HTTP request handling
// =====================
Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Accept monitor_id via POST JSON or query string (?monitor_id=...)
    let targetMonitorId: string | undefined;
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      if (typeof body?.monitor_id === "string") targetMonitorId = body.monitor_id;
    } else if (req.method === "GET") {
      const url = new URL(req.url);
      const qid = url.searchParams.get("monitor_id");
      if (qid) targetMonitorId = qid;
    }

    const monitors = await loadMonitors(targetMonitorId);
    const isManualTest = Boolean(targetMonitorId) && monitors.length === 1;

    const results: any[] = [];

    for (const m of monitors) {
      // Skip disabled (defensive, in case loadMonitors returns any)
      if (m.enabled === false) {
        results.push({ id: m.id, skipped: true, reason: "disabled" });
        continue;
      }

      // 1) Probe
      const probe = await probeUrl(m.url);
      const nextStatus: "UP" | "DOWN" = probe.ok ? "UP" : "DOWN";
      const prevStatus: "UP" | "DOWN" = (m.status ?? "UP") as any;
      const transitioned = nextStatus !== prevStatus;

      // 2) Decide whether we want an alert
      //    - Manual: send only if currently DOWN (transition doesn't matter)
      //    - Auto: send only on transition to DOWN
      const wantsAlert =
        (isManualTest && nextStatus === "DOWN") ||
        (!isManualTest && transitioned && nextStatus === "DOWN");

      // 3) Cooldown rule:
      //    - Manual tests BYPASS cooldown
      //    - Auto checks MUST pass cooldown
      const cooldownOK = isManualTest ? true : await shouldSendEmailWithCooldown(m);

      const shouldSendEmail = wantsAlert && cooldownOK && !DISABLE_ALERTS;

      // 4) Send email if needed (DOWN-only)
      let email: { ok: boolean; skipped?: boolean } | null = null;
      if (shouldSendEmail) {
        email = await invokeSendEmail({
          monitor: m,
          type: "DOWN",
          probeResult: probe,
        });

        // Update last_alert_sent:
        // - If MANUAL_COUNTS_FOR_COOLDOWN is true: update on all sends.
        // - Otherwise: only update for automatic sends.
        if (email.ok && (!isManualTest || MANUAL_COUNTS_FOR_COOLDOWN)) {
          await markLastAlertSent(m.id);
        }
      }

      // 5) Persist the new status (always)
      await updateMonitorStatus(m.id, nextStatus);

      results.push({
        id: m.id,
        name: m.name ?? null,
        url: m.url,
        prev_status: prevStatus,
        next_status: nextStatus,
        transitioned,
        is_manual_test: isManualTest,
        wants_alert: wantsAlert,
        cooldown_ok: cooldownOK,
        email_sent: Boolean(shouldSendEmail && email?.ok),
        email_skipped: email?.skipped ?? false,
        http: { ok: probe.ok, status: probe.status ?? null, error: probe.error },
      });
    }

    return new Response(JSON.stringify({ ok: true, now: nowIso(), results }, null, 2), {
      headers: { "content-type": "application/json", ...corsHeaders },
    });
  } catch (err: any) {
    console.error(err);
    return new Response(
      JSON.stringify({ ok: false, error: err?.message ?? String(err) }, null, 2),
      { status: 500, headers: { "content-type": "application/json", ...corsHeaders } },
    );
  }
});
