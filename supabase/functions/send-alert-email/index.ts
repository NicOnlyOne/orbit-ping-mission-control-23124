import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

const TIMEOUT_MS = 15_000;

type Monitor = {
  id: string;
  name: string | null;
  url: string | null;
  status: "UP" | "DOWN" | null;
  last_alert_sent: string | null;
  user_id: string | null;
  alert_cooldown_minutes: number | null;
  enabled: boolean | null;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function minutesSince(iso: string | null): number {
  if (!iso) return Number.POSITIVE_INFINITY;
  return (Date.now() - new Date(iso).getTime()) / 60000;
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

  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "1";
  const targetId = url.searchParams.get("id");
  const targetUrl = url.searchParams.get("url");

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const resendKey = Deno.env.get("RESEND_API_KEY") || "";

    let query = supabase
      .from("monitors")
      .select<"*, Monitor">(
        "id, name, url, status, last_alert_sent, user_id, alert_cooldown_minutes, enabled"
      );

    if (targetId) query = query.eq("id", targetId);
    if (targetUrl) query = query.eq("url", targetUrl);

    const { data: monitors, error } = await query;
    if (error) {
      console.error("Error fetching monitors:", error);
      return new Response(JSON.stringify({ error: "fetch_monitors_failed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    const active = (monitors || []).filter((m) => (m.enabled ?? true) && !!m.url);
    const results: Array<{ 
      id: string; 
      nextStatus: "UP" | "DOWN"; 
      emailed: boolean; 
      reason?: string;
      previousStatus?: string;
    }> = [];

    for (const m of active) {
      const previousStatus = m.status;
      const p = await probeUrl(m.url!);
      const nextStatus: "UP" | "DOWN" = p.ok ? "UP" : "DOWN";

      // Get user email from profiles
      const { data: profile } = await supabase
        .from('profiles')
        .select('email')
        .eq('user_id', m.user_id)
        .single();

      const userEmail = profile?.email;

      // Cooldown check
      const cooldownMin = m.alert_cooldown_minutes ?? 60;
      const outsideCooldown = minutesSince(m.last_alert_sent) >= cooldownMin;

      // Determine if we should send email
      let shouldEmail = false;
      let emailType: "DOWN" | "RECOVERY" | null = null;

      if (nextStatus === "DOWN" && userEmail && resendKey && (outsideCooldown || force)) {
        shouldEmail = true;
        emailType = "DOWN";
      } else if (nextStatus === "UP" && previousStatus === "DOWN" && userEmail && resendKey) {
        shouldEmail = true;
        emailType = "RECOVERY";
      }

      // Log check
      await supabase.from("monitor_checks").insert({
        monitor_id: m.id,
        status: nextStatus,
        response_time: p.responseTime,
        error_message: p.error ?? null,
      });

      let emailed = false;
      let reason: string | undefined;

      if (shouldEmail && emailType) {
        try {
          const isDown = emailType === "DOWN";
          const subject = isDown 
            ? `🚨 Mission Down: ${m.name ?? m.url}`
            : `✅ Mission Recovered: ${m.name ?? m.url}`;
            
          const bodyHtml = isDown ? `
            <h1>🚨 Houston, we have a problem!</h1>
            <p>Your mission <strong>${m.name ?? m.url}</strong> is currently offline.</p>
            <ul>
              <li><strong>URL:</strong> ${m.url}</li>
              <li><strong>Time:</strong> ${new Date().toUTCString()}</li>
              <li><strong>Error:</strong> ${p.error || `HTTP ${p.status}`}</li>
              <li><strong>Response Time:</strong> ${p.responseTime}ms</li>
            </ul>
            <p>Please investigate the status of your system.</p>
            <p><em>- OrbitPing Mission Control</em></p>
          ` : `
            <h1>✅ Mission Back Online!</h1>
            <p>Good news! Your mission <strong>${m.name ?? m.url}</strong> is back online.</p>
            <ul>
              <li><strong>URL:</strong> ${m.url}</li>
              <li><strong>Recovery Time:</strong> ${new Date().toUTCString()}</li>
              <li><strong>Response Time:</strong> ${p.responseTime}ms</li>
            </ul>
            <p>All systems are operational.</p>
            <p><em>- OrbitPing Mission Control</em></p>
          `;

          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${resendKey}`,
            },
            body: JSON.stringify({
              from: "Mission Control <onboarding@resend.dev>",
              to: [userEmail!],
              subject,
              html: bodyHtml,
            }),
          });
          
          const body = await res.json().catch(() => ({}));
          console.log("Resend response", res.status, body);
          emailed = res.ok;
          if (!emailed) reason = `Resend failed: ${res.status}`;
        } catch (e) {
          reason = e instanceof Error ? e.message : String(e);
          console.error("Resend send error", e);
        }
      } else {
        reason = !userEmail
          ? "no user email"
          : !resendKey
          ? "no RESEND_API_KEY"
          : nextStatus === "UP" && previousStatus !== "DOWN"
          ? "not a recovery or down state"
          : outsideCooldown || force
          ? "conditions not met"
          : "cooldown active";
      }

      const update: Record<string, unknown> = {
        status: nextStatus,
        last_checked: new Date().toISOString(),
        response_time: p.responseTime,
        error_message: p.error ?? null,
      };
      if (emailed && emailType === "DOWN") {
        update.last_alert_sent = new Date().toISOString();
      }

      await supabase.from("monitors").update(update).eq("id", m.id);
      results.push({ 
        id: m.id, 
        nextStatus, 
        emailed, 
        reason, 
        previousStatus: previousStatus || undefined 
      });
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