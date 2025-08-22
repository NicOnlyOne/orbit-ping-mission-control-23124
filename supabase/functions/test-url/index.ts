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

// Create a single Supabase client instance
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

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
  const query = supabase.from(TABLE_MONITORS).select("*");
  if (targetMonitorId) {
    query.eq("id", targetMonitorId);
  } else {
    query.eq("enabled", true);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).filter((m): m is MonitorRow => !!m);
}

// ========================
// Business logic
// ========================
type ProbeResult = { ok: boolean; status?: number; error?: string };

async function probeUrl(url: string): Promise<ProbeResult> {
  try {
    const res = await withTimeout(fetch(url, { method: "HEAD", redirect: "follow" }), TIMEOUT_MS);
    return { ok: res.ok, status: res.status };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? String(err) };
  }
}

async function shouldSendEmailWithCooldown(monitor: MonitorRow): Promise<boolean> {
  if (!monitor.last_alert_sent) return true;
  return minutesSince(monitor.last_alert_sent) >= COOLDOWN_MINUTES;
}

// ========================
// Main request handler
// ========================
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const targetMonitorId: string | undefined = payload.id;
    const isManualTest = !!targetMonitorId;

    const monitors = await loadMonitors(targetMonitorId);
    const results: any[] = [];
    const tasks: Promise<any>[] = []; // Our "to-do list" of promises

    for (const m of monitors) {
      if (!m.enabled) {
        results.push({ id: m.id, skipped: true, reason: "disabled" });
        continue;
      }

      const probe = await probeUrl(m.url);
      const nextStatus: "UP" | "DOWN" = probe.ok ? "UP" : "DOWN";
      const prevStatus: "UP" | "DOWN" = (m.status ?? "UP") as any;
      const transitioned = nextStatus !== prevStatus;
      
      const wantsAlert = isManualTest || (!isManualTest && transitioned && nextStatus === "DOWN");
      const cooldownOK = isManualTest ? true : await shouldSendEmailWithCooldown(m);
      const shouldSendEmail = wantsAlert && cooldownOK && !DISABLE_ALERTS;

      let emailSent = false;
      if (shouldSendEmail) {
        const toEmail = m.notify_email;
        if (toEmail) {
          console.log(`Queueing 'send-alert-email' for monitor: ${m.name}`);
          // Add the email task to our to-do list
          tasks.push(
            supabase.functions.invoke('send-alert-email', {
              body: { monitor: m, type: nextStatus, probeResult: probe, to: toEmail }
            })
          );

          if (!isManualTest || MANUAL_COUNTS_FOR_COOLDOWN) {
            // Add the database update to our to-do list
            tasks.push(
              supabase.from(TABLE_MONITORS).update({ last_alert_sent: nowIso() }).eq("id", m.id)
            );
          }
          emailSent = true;
        }
      }

      // Add the final status update to our to-do list
      tasks.push(
        supabase.from(TABLE_MONITORS).update({ status: nextStatus, last_checked: nowIso() }).eq("id", m.id)
      );

      results.push({
        id: m.id, name: m.name ?? null, url: m.url, prev_status: prevStatus,
        next_status: nextStatus, transitioned, is_manual_test: isManualTest,
        wants_alert: wantsAlert, cooldown_ok: cooldownOK, email_sent: emailSent,
        http: { ok: probe.ok, status: probe.status ?? null, error: probe.error },
      });
    }

    // This is the critical change: wait for ALL tasks in the to-do list to finish
    console.log(`Waiting for ${tasks.length} background tasks to complete...`);
    await Promise.all(tasks);
    console.log("All background tasks finished.");

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
