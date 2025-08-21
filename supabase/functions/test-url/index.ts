// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FALLBACK_TO = Deno.env.get("ALERT_FALLBACK_TO") || null;

type Monitor = {
  id: string;
  url: string;
  name?: string | null;
  status?: string | null;         // unknown enum/text in your schema
  email_to?: string | null;
  user_id?: string | null;
};

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

function candidateStatuses(next: "UP" | "DOWN"): string[] {
  // Try likely values to satisfy your monitors_status_check
  return next === "UP"
    ? ["UP", "up", "ONLINE", "Online", "online", "Ok", "OK", "Healthy"]
    : ["DOWN", "down", "OFFLINE", "Offline", "offline", "Fail", "FAILED", "Unhealthy"];
}

async function tryUpdateStatus(
  supabase: ReturnType<typeof createClient>,
  monitorId: string,
  next: "UP" | "DOWN"
): Promise<{ ok: boolean; value?: string; error?: any }> {
  const candidates = candidateStatuses(next);

  // We also try with/without updated_at for portability
  for (const value of candidates) {
    // first attempt with updated_at
    let { error } = await supabase
      .from("monitors")
      .update({ status: value, updated_at: new Date().toISOString() })
      .eq("id", monitorId);
    if (!error) return { ok: true, value };
    // If the error is "unknown column updated_at" (PGRST204), retry without it
    if (error?.code === "PGRST204") {
      const { error: e2 } = await supabase.from("monitors").update({ status: value }).eq("id", monitorId);
      if (!e2) return { ok: true, value };
      // 23514 = check constraint violation → continue to next candidate
      if (e2.code !== "23514") return { ok: false, error: e2 };
    } else if (error?.code !== "23514") {
      // Not a check-constraint issue → stop
      return { ok: false, error };
    }
    // else 23514, try next candidate
  }
  return { ok: false, error: { message: "All status candidates rejected by monitors_status_check" } };
}

async function getRecipientEmail(
  supabase: ReturnType<typeof createClient>,
  m: Monitor
): Promise<string | null> {
  if (m.email_to) return m.email_to;
  // Optional: look up profiles email if you actually have it
  if (m.user_id) {
    const { data, error } = await supabase.from("profiles").select("email").eq("id", m.user_id).maybeSingle();
    if (!error && (data as any)?.email) return (data as any).email as string;
  }
  return FALLBACK_TO; // last resort so we can test end-to-end
}

async function invokeSendEmail(
  supabase: ReturnType<typeof createClient>,
  payload: any
) {
  const { data, error } = await supabase.functions.invoke("send-alert-email", { body: payload });
  if (error) console.error("invoke send-alert-email failed", error);
  else console.log("send-alert-email invoked:", data ?? "ok");
}

Deno.serve(async (req) => {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  const body = await req.json().catch(() => ({}));
  const targetMonitorId: string | undefined = body?.monitor_id;

  // Load monitors
  let monitors: Monitor[] = [];
  if (targetMonitorId) {
    const { data, error } = await supabase.from("monitors").select("*").eq("id", targetMonitorId);
    if (error) return new Response(error.message, { status: 500 });
    monitors = data as Monitor[];
  } else {
    const { data, error } = await supabase.from("monitors").select("*").neq("url", null);
    if (error) return new Response(error.message, { status: 500 });
    monitors = data as Monitor[];
  }

  const results: any[] = [];

  for (const m of monitors) {
    // Treat any non-"down" string as UP unless it clearly looks like a down value
    const prev = (m.status || "").toString().toLowerCase();
    const prevStatus: "UP" | "DOWN" = ["down", "offline", "fail", "failed", "unhealthy"].includes(prev) ? "DOWN" : "UP";

    const probe = await ping(m.url);
    const nextStatus: "UP" | "DOWN" = probe.ok ? "UP" : "DOWN";
    const transitioned = nextStatus !== prevStatus;

    // Update status using retry strategy
    let updateOk = true;
    let storedAs: string | undefined;
    if (transitioned) {
      const upd = await tryUpdateStatus(supabase, m.id, nextStatus);
      updateOk = upd.ok;
      storedAs = upd.value;
      if (!upd.ok) console.error("update monitor failed", m.id, upd.error);
    }

    // Email on transitions (only if we can resolve recipient)
    if (transitioned) {
      const to = await getRecipientEmail(supabase, m);
      if (!to) {
        console.warn("No recipient email for monitor", m.id);
      } else {
        await invokeSendEmail(supabase, {
          type: nextStatus, // DOWN or UP
          monitor: { id: m.id, name: m.name ?? m.url, url: m.url },
          to,
          probe: { ok: probe.ok, status: probe.status, ms: probe.ms, error: probe.error },
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
      updateOk,
      storedStatusValue: storedAs ?? null,
    });
  }

  return new Response(JSON.stringify({ ok: true, results }, null, 2), {
    headers: { "content-type": "application/json" },
  });
});
