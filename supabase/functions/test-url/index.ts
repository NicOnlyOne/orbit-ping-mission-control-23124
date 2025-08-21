// supabase/functions/test-url/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET"); // optional if triggered by scheduler

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  global: { headers: { "X-Client-Info": "orbit-ping/test-url" } },
});

const Input = z.object({
  monitor_id: z.string().uuid().optional(),
  // or batch run: no body, the function will pick due monitors by next_check_at/interval
});

async function invokeSendEmail(payload: any) {
  // Use internal function invoke so JWT is handled; don't call the public URL.
  const { data, error } = await supabase.functions.invoke("send-alert-email", {
    body: payload,
  });
  if (error) {
    console.error("invoke send-alert-email error:", error);
  } else {
    console.log("send-alert-email invoked:", data);
  }
}

async function checkOneMonitor(m: any) {
  const started = Date.now();
  let ok = false;
  let status = 0;
  let text: string | null = null;
  let reason = "";

  try {
    const res = await fetch(m.url, {
      method: "GET",
      redirect: "manual",
      headers: { "user-agent": "OrbitPing/1.0 (+https://orbit)" },
    });
    status = res.status;
    text = await res.text();
    const expected = m.expected_status ?? 200;
    ok = status === expected || (status >= 200 && status < 300 && expected === 200);
    reason = ok ? `HTTP ${status}` : `Unexpected status ${status}`;
  } catch (e) {
    ok = false;
    reason = `Fetch error: ${(e as Error).message}`;
  }

  const durationMs = Date.now() - started;

  // Update counters and status, determine transitions
  let nextStatus = ok ? "up" : "down";
  let consecutive_failures = m.consecutive_failures ?? 0;
  let consecutive_successes = m.consecutive_successes ?? 0;

  if (ok) {
    consecutive_successes += 1;
    consecutive_failures = 0;
  } else {
    consecutive_failures += 1;
    consecutive_successes = 0;
  }

  const failure_threshold = m.failure_threshold ?? 3;
  const recovery_threshold = m.recovery_threshold ?? 2;

  let transitionedToDown = false;
  let transitionedToUp = false;

  if (m.status !== "down" && !ok && consecutive_failures >= failure_threshold) {
    transitionedToDown = true;
    nextStatus = "down";
  }
  if (m.status === "down" && ok && consecutive_successes >= recovery_threshold) {
    transitionedToUp = true;
    nextStatus = "up";
  }

  // Persist monitor counters + status
  const { error: upErr } = await supabase
    .from("monitors")
    .update({
      last_check_at: new Date().toISOString(),
      status: nextStatus,
      consecutive_failures,
      consecutive_successes,
      last_latency_ms: durationMs,
    })
    .eq("id", m.id);

  if (upErr) console.error("update monitor error:", upErr);

  // Open/resolve incident rows minimally (optional; adapt to your schema)
  if (transitionedToDown) {
    const { data: incident, error: incErr } = await supabase
      .from("incidents")
      .insert({
        monitor_id: m.id,
        opened_at: new Date().toISOString(),
        last_change_reason: reason,
      })
      .select("id")
      .single();
    if (incErr) console.error("insert incident error:", incErr);

    // Invoke email sender
    await invokeSendEmail({
      type: "down",
      monitor: {
        id: m.id,
        name: m.name,
        url: m.url,
      },
      to: m.email_to_notify, // field must exist in your monitors or profile table
      context: { status, reason, durationMs },
    });
  } else if (transitionedToUp) {
    // Resolve the latest open incident
    const { data: lastOpen, error: findErr } = await supabase
      .from("incidents")
      .select("id")
      .eq("monitor_id", m.id)
      .is("resolved_at", null)
      .order("opened_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (findErr) console.error("find incident error:", findErr);
    if (lastOpen) {
      const { error: resErr } = await supabase
        .from("incidents")
        .update({ resolved_at: new Date().toISOString(), last_change_reason: reason })
        .eq("id", lastOpen.id);
      if (resErr) console.error("resolve incident error:", resErr);
    }

    await invokeSendEmail({
      type: "up",
      monitor: {
        id: m.id,
        name: m.name,
        url: m.url,
      },
      to: m.email_to_notify,
      context: { status, reason, durationMs },
    });
  }

  return { ok, status, reason, durationMs, transitionedToDown, transitionedToUp };
}

serve(async (req) => {
  // Optional: protect if called by external cron
  if (CRON_SECRET) {
    const s = req.headers.get("x-cron-secret");
    if (s !== CRON_SECRET) return new Response("forbidden", { status: 403 });
  }

  if (req.method === "POST") {
    const txt = await req.text();
    const body = txt ? JSON.parse(txt) : {};
    const parse = Input.safeParse(body);
    if (!parse.success) {
      return new Response(JSON.stringify({ error: parse.error.flatten() }), { status: 400 });
    }

    if (parse.data.monitor_id) {
      const { data: m, error } = await supabase.from("monitors").select("*").eq("id", parse.data.monitor_id).single();
      if (error || !m) return new Response("monitor not found", { status: 404 });
      const result = await checkOneMonitor(m);
      return new Response(JSON.stringify({ result }), { status: 200 });
    }
  }

  // Batch mode: check due monitors (simple example: enabled and status known)
  const { data: monitors, error } = await supabase
    .from("monitors")
    .select("*")
    .eq("enabled", true)
    .limit(20); // keep it small per run

  if (error) {
    console.error("fetch monitors error:", error);
    return new Response("error", { status: 500 });
  }

  const results: any[] = [];
  for (const m of monitors ?? []) {
    try {
      const r = await checkOneMonitor(m);
      results.push({ id: m.id, ...r });
    } catch (e) {
      console.error("checkOneMonitor error:", e);
    }
  }

  return new Response(JSON.stringify({ checked: results.length, results }), { status: 200 });
});
