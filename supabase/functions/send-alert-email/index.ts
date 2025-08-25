// supabase/functions/send-alert-email/index.ts
// Edge function: checks monitors, updates status, and emails via Resend when DOWN.
// Uses a cooldown to avoid spam.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

const TIMEOUT_MS = 15_000;

type Monitor = {
  id: string;
  name: string | null;
  url: string | null;
  status: "UP" | "DOWN" | null;
  last_alert_sent: string | null;
  notify_email: string | null;
  alert_cooldown_minutes: number | null;
  enabled: boolean | null;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function minutesSince(iso: string | null): number {
  if (!iso) return Number.POSITIVE_INFINITY;
  const then = new Date(iso).getTime();
  return (Date.now() - then) / 60000;
}

async function probeUrl(url: string) {
  const start = Date.now();
  try {
    const res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return {
      ok: res.ok || (res.status >= 200 && res.status < 400),
      status: res.status,
      responseTime: Date.now() - start,
      error: undefined as string | undefined,
    };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      responseTime: Date.now() - start,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendKey = Deno.env.get("RESEND_API_KEY") || "";

    const supabase = createClient(supabaseUrl, serviceKey);

    // Load monitors
    const { data: monitors, error } = await supabase
      .from("monitors")
      .select<"*, Monitor">(
        "id, name, url, status, last_alert_sent, notify_email, alert_cooldown_minutes, enabled"
      );

    if (error) {
      console.error("Error fetching monitors:", error);
      return new Response(JSON.stringify({ error: "fetch_monitors_failed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    const active = (monitors || []).filter((m) => (m.enabled ?? true) && !!m.url);
    const results: Array<{ id: string; nextStatus: "UP" | "DOWN"; emailed: boolean }> = [];

    for (const m of active) {
      const url = m.url!;
      const probe = await probeUrl(url);
      const nextStatus: "UP" | "DOWN" = probe.ok ? "UP" : "DOWN";

      const cooldownMin = m.alert_cooldown_minutes ?? 60;
      const canEmail =
        nextStatus === "DOWN" &&
        !!m.notify_email &&
        minutesSince(m.last_alert_sent) >= cooldownMin &&
        !!resendKey;

      // Optional: log each check
      await supabase.from("monitor_checks").insert({
        monitor_id: m.id,
        status: nextStatus,
        response_time: probe.responseTime,
        error_message: probe.error ?? null,
      });

      let emailed = false;
      if (canEmail) {
        try {
          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${resendKey}`,
            },
            body: JSON.stringify({
              from: "Mission Control <onboarding@resend.dev>",
              to: [m.notify_email],
              subject:
                nextStatus === "DOWN"
                  ? `🚨 ${m.name ?? "Monitor"} is DOWN`
                  : `✅ ${m.name ?? "Monitor"} is UP`,
              html:
                nextStatus === "DOWN"
                  ? `<p>Commander,</p><p><strong>${m.name ?? url}</strong> is unresponsive.</p><p>URL: ${url}</p><p>Error: ${
                      probe.error ?? `HTTP ${probe.status}`
                    }</p><p>We will continue monitoring.</p><p>- OrbitPing Mission Control</p>`
                  : `<p>Good news!</p><p><strong>${m.name ?? url}</strong> is back UP.</p><p>- OrbitPing Mission Control</p>`,
            }),
          });
          const body = await res.json().catch(() => ({}));
          console.log("Resend response", res.status, body);
          emailed = res.ok;
        } catch (e) {
          console.error("Resend send error", e);
        }
      }

      const update: Record<string, unknown> = {
        status: nextStatus,
        last_checked: new Date().toISOString(),
        response_time: probe.responseTime,
        error_message: probe.error ?? null,
      };
      if (emailed) update.last_alert_sent = new Date().toISOString();

      await supabase.from("monitors").update(update).eq("id", m.id);
      results.push({ id: m.id, nextStatus, emailed });
    }

    return new Response(JSON.stringify({ ok: true, checked: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e) {
    console.error("Function error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
