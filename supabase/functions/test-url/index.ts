// deno-lint-ignore-file no-explicit-any
// Edge Function: test-url
// - Checks one or many monitors
// - On transition, invokes send-alert-email with payload

// Deno-friendly imports
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type Monitor = {
  id: string;
  url: string;
  status?: "UP" | "DOWN";
  failure_threshold?: number | null;
  recovery_threshold?: number | null;
  consecutive_failures?: number | null;
  consecutive_successes?: number | null;
  email_to?: string | null;
  user_id?: string | null;
  name?: string | null;
};

type Incident = {
  id: string;
  monitor_id: string;
  opened_at: string;
  resolved_at?: string | null;
  last_error?: string | null;
};

const DEFAULT_FAILURE_THRESHOLD = 3;
const DEFAULT_RECOVERY_THRESHOLD = 2;
const TIMEOUT_MS = 15000;

function withTimeout(ms: number) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, clear: () => clearTimeout(id) };
}

async function ping(url: string) {
  const t0 = Date.now();
  const ctl = withTimeout(TIMEOUT_MS);
  try {
    const res = await fetch(url, { method: "GET", signal: ctl.signal });
    const ok = res.ok;
    const status = res.status;
    const text = ok ? "" : await res.text().catch(() => "");
    return { ok, status, ms: Date.now() - t0, error: ok ? undefined : `HTTP ${status} ${text?.slice(0, 200)}` };
  } catch (e: any) {
    return { ok: false, status: 0, ms: Date.now() - t0, error: e?.message || "fetch_error" };
  } finally {
    ctl.clear();
  }
}

async function getRecipientEmail(
  supabase: ReturnType<typeof createClient>,
  m: Monitor
): Promise<string | null> {
  if (m.email_to) return m.email_to;
  if (!m.user_id) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", m.user_id)
    .maybeSingle();
  if (error) {
    console.warn("profiles lookup error", error);
    return null;
  }
  return data?.email ?? null;
}

async function openIncident(
  supabase: ReturnType<typeof createClient>,
  monitor_id: string,
  last_error?: string
): Promise<Incident | null> {
  const { data, error } = await supabase
    .from("incidents")
    .insert({ monitor_id, opened_at: new Date().toISOString(), last_error })
    .select()
    .single();
  if (error) {
    console.error("openIncident error", error);
    return null;
  }
  return data as Incident;
}

async function closeOpenIncident(
  supabase: ReturnType<typeof createClient>,
  monitor_id: string
): Promise<Incident | null> {
  // Close the most recent open incident (resolved_at null)
  const { data: openInc, error: qErr } = await supabase
    .from("incidents")
    .select("*")
    .eq("monitor_id", monitor_id)
    .is("resolved_at", null)
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (qErr) {
    console.warn("query open incident failed", qErr);
    return null;
  }
  if (!openInc) return null;
  const { data, error } = await supabase
    .from("incidents")
    .update({ resolved_at: new Date().toISOString() })
    .eq("id", openInc.id)
    .select()
    .single();
  if (error) {
    console.error("closeIncident error", error);
    return null;
  }
  return data as Incident;
}

async function invokeSendEmail(
  supabase: ReturnType<typeof createClient>,
  payload: any
) {
  // Using functions.invoke ensures proper Authorization so verify_jwt can remain true.
  const { data, error } = await supabase.functions.invoke("send-alert-email", {
    body: payload,
  });
  if (error) {
    console.error("invoke send-alert-email failed", error);
  } else {
    console.log("send-alert-email invoked:", data ?? "ok");
  }
}

Deno.serve(async (req) => {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false },
  });

  const body = await req.json().catch(() => ({}));
  const targetMonitorId: string | undefined = body?.monitor_id;

  // Load monitors (single or all active)
  let monitors: Monitor[] = [];
  if (targetMonitorId) {
    const { data, error } = await supabase
      .from("monitors")
      .select("*")
      .eq("id", targetMonitorId);
    if (error) return new Response(error.message, { status: 500 });
    monitors = data as Monitor[];
  } else {
    const { data, error } = await supabase
      .from("monitors")
      .select("*")
      .neq("url", null);
    if (error) return new Response(error.message, { status: 500 });
    monitors = data as Monitor[];
  }

  const results: any[] = [];

  for (const m of monitors) {
    const prevStatus = (m.status ?? "UP") as "UP" | "DOWN";
    const failureThreshold = m.failure_threshold ?? DEFAULT_FAILURE_THRESHOLD;
    const recoveryThreshold = m.recovery_threshold ?? DEFAULT_RECOVERY_THRESHOLD;
    let cf = m.consecutive_failures ?? 0;
    let cs = m.consecutive_successes ?? 0;

    const probe = await ping(m.url);
    let nextStatus: "UP" | "DOWN" = prevStatus;

    if (probe.ok) {
      cs += 1;
      cf = 0;
      if (prevStatus === "DOWN" && cs >= recoveryThreshold) {
        nextStatus = "UP";
      }
    } else {
      cf += 1;
      cs = 0;
      if (prevStatus === "UP" && cf >= failureThreshold) {
        nextStatus = "DOWN";
      }
    }

    // Persist counters and status
    const updates: any = {
      consecutive_failures: cf,
      consecutive_successes: cs,
      status: nextStatus,
      updated_at: new Date().toISOString(),
    };
    const { error: upErr } = await supabase
      .from("monitors")
      .update(updates)
      .eq("id", m.id);
    if (upErr) console.error("update monitor failed", m.id, upErr);

    const transitioned = nextStatus !== prevStatus;
    let incidentOpened: Incident | null = null;
    let incidentClosed: Incident | null = null;

    if (transitioned && nextStatus === "DOWN") {
      incidentOpened = await openIncident(supabase, m.id, probe.error);
    } else if (transitioned && nextStatus === "UP") {
      incidentClosed = await closeOpenIncident(supabase, m.id);
    }

    // Only email on transitions
    if (transitioned) {
      const to = await getRecipientEmail(supabase, m);
      if (!to) {
        console.warn("No recipient email for monitor", m.id);
      } else {
        await invokeSendEmail(supabase, {
          type: nextStatus === "DOWN" ? "DOWN" : "UP",
          monitor: { id: m.id, name: m.name ?? m.url, url: m.url },
          to,
          probe: { ok: probe.ok, status: probe.status, ms: probe.ms, error: probe.error },
          incident_id: incidentOpened?.id ?? incidentClosed?.id ?? null,
          occurred_at: new Date().toISOString(),
        });
      }
    }

    results.push({
      monitor_id: m.id,
      prevStatus,
      nextStatus,
      transitioned,
      http_status: probe.status,
      ms: probe.ms,
      error: probe.error,
    });
  }

  return new Response(JSON.stringify({ ok: true, results }, null, 2), {
    headers: { "content-type": "application/json" },
  });
});
