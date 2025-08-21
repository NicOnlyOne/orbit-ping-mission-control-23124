// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type Monitor = {
  id: string;
  url: string;
  name?: string | null;
  status?: "UP" | "DOWN" | null;
  email_to?: string | null;
  user_id?: string | null;
  // updated_at is optional in your schema
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
  return (data as any)?.email ?? null;
}

async function openIncident(
  supabase: ReturnType<typeof createClient>,
  monitor_id: string,
  last_error?: string
) {
  const { data, error } = await supabase
    .from("incidents")
    .insert({ monitor_id, opened_at: new Date().toISOString(), last_error })
    .select()
    .single();
  if (error) console.error("openIncident error", error);
  return data;
}

async function closeOpenIncident(
  supabase: ReturnType<typeof createClient>,
  monitor_id: string
) {
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
    .eq("id", (openInc as any).id)
    .select()
    .single();
  if (error) console.error("closeIncident error", error);
  return data;
}

async function invokeSendEmail(
  supabase: ReturnType<typeof createClient>,
  payload: any
) {
  const { data, error } = await supabase.functions.invoke("send-alert-email", {
    body: payload,
  });
  if (error) console.error("invoke send-alert-email failed", error);
  else console.log("send-alert-email invoked:", data ?? "ok");
}

Deno.serve(async (req) => {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false },
  });

  const body = await req.json().catch(() => ({}));
  const targetMonitorId: string | undefined = body?.monitor_id;

  // 1) Load monitors
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
    const prevStatus = (m.status ?? "UP") as "UP" | "DOWN";
    const probe = await ping(m.url);
    const nextStatus: "UP" | "DOWN" = probe.ok ? "UP" : "DOWN";
    const transitioned = nextStatus !== prevStatus;

    // 2) Update only columns that surely exist
    const updates: Record<string, any> = { status: nextStatus };
    // if your table has updated_at, this will work; if not, PostgREST will ignore unknown column only if we don't send it
    // so we check existence cheaply by attempting once and falling back if needed
    let updated = false;
    try {
      const { error: upErr } = await supabase.from("monitors").update({ ...updates, updated_at: new Date().toISOString() }).eq("id", m.id);
      if (upErr?.code === "PGRST204") {
        // updated_at does not exist; retry without it
        const { error: up2 } = await supabase.from("monitors").update(updates).eq("id", m.id);
        if (up2) console.error("update monitor failed", m.id, up2);
      } else if (upErr) {
        console.error("update monitor failed", m.id, upErr);
      } else {
        updated = true;
      }
    } catch (e) {
      console.error("update monitor threw", m.id, e);
    }

    // 3) Incident open/close only on transitions
    let incidentOpened: any = null;
    let incidentClosed: any = null;

    if (transitioned && nextStatus === "DOWN") {
      incidentOpened = await openIncident(supabase, m.id, probe.error);
    } else if (transitioned && nextStatus === "UP") {
      incidentClosed = await closeOpenIncident(supabase, m.id);
    }

    // 4) Invoke email on transitions
    if (transitioned) {
      const to = await getRecipientEmail(supabase, m);
      if (!to) {
        console.warn("No recipient email for monitor", m.id);
      } else {
        await invokeSendEmail(supabase, {
          type: nextStatus,
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
      updated,
    });
  }

  return new Response(JSON.stringify({ ok: true, results }, null, 2), {
    headers: { "content-type": "application/json" },
  });
});
