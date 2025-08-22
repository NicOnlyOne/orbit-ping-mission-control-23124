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
    .update({ status: nextStatus, last_checked: nowIso() }) // Also update last_checked time
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

// REAL EMAIL INTEGRATION
async function invokeSendEmail(args: {
  monitor: MonitorRow;
  type: "DOWN" | "UP"; // Allow "UP" type for testing
  probeResult: { ok: boolean; status?: number; error?: string | null };
}) {
  if (DISABLE_ALERTS) return { ok: true, skipped: true };

  const to = args.monitor.notify_email;
  if (!to) {
    console.warn(`Monitor ${args.monitor.id} has no notify_email; skipping email.`);
    return { ok: false, skipped: true };
  }

  try {
    console.log(`🚀 Calling send-alert-email function for monitor: ${args.monitor.name}`);

    // The 'type' will now be based on the actual status, which helps the email template.
    const alertPayload = {
        monitor: args.monitor,
        type: args.probeResult.ok ? 'UP' : 'DOWN',
        probeResult: args.probeResult,
    }

    const { data, error } = await supabase.functions.invoke('send-alert-email', {
      body: alertPayload
    });

    if (error) {
      console.error('❌ send-alert-email function error:', error);
      return { ok: false, error: error.message };
    }

    console.log('✅ send-alert-email function success:', data);
    return { ok: true, result: data };

  } catch (error) {
    console.error('❌ Error calling send-alert-email function:', error);
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
      // ============================================================================
      // ===> THIS IS THE ONLY LINE I CHANGED <===
      const wantsAlert = isManualTest || (!isManualTest && transitioned && nextStatus === "DOWN");
      // ============================================================================

      // 3) Cooldown rule
      const cooldownOK = isManualTest ? true : await shouldSendEmailWithCooldown(m);
      const shouldSendEmail = wantsAlert && cooldownOK && !DISABLE_ALERTS;

      // 4) Send email if needed
      let email: { ok: boolean; skipped?: boolean } | null = null;
      if (shouldSendEmail) {
        email = await invokeSendEmail({
          monitor: m,
          type: nextStatus, // Send the actual status
          probeResult: probe,
        });

        if (email.ok && (!isManualTest || MANUAL_COUNTS_FOR_COOLDOWN)) {
          await markLastAlertSent(m.id);
        }
      }

      // 5) Persist the new status
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
