// PASTE THIS CORRECTED CODE INTO: supabase/functions/send-alert-email/index.ts

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

const COOLDOWN_MINUTES = 60;
const TIMEOUT_MS = 15_000;

type Monitor = {
  id: string;
  name: string;
  url: string;
  status: "UP" | "DOWN" | null;
  last_alert_sent: string | null;
  notify_email: string | null;
};

async function probeUrl(url: string) {
  const startTime = Date.now();
  try {
    const response = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(TIMEOUT_MS) });
    const responseTime = Date.now() - startTime;
    return {
      ok: response.ok,
      status: response.status,
      responseTime
    };
  } catch (err) {
    const responseTime = Date.now() - startTime;
    const errorMessage = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      status: 0,
      error: errorMessage,
      responseTime
    };
  }
}

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: monitors, error: fetchError } = await supabase
    .from("monitors")
    .select<"*", Monitor>("id, name, url, status, last_alert_sent, notify_email");

  if (fetchError) {
    console.error("Error fetching monitors:", fetchError.message);
    return new Response("Error fetching monitors", { status: 500 });
  }

  const now = new Date();

  const checkPromises = monitors.map(async (m) => {
    // --- THIS IS THE CRITICAL CHANGE ---
    const probeResult = await probeUrl(m.url);
    const isUp = probeResult.ok;
    const errorMessage = isUp ? null : (probeResult.error || `HTTP ${probeResult.status}`);

    if (isUp) {
      if (m.status === "DOWN") {
        console.log(`Monitor ${m.id} (${m.url}) is back UP.`);
      }
      await supabase.from("monitors").update({
        status: "UP",
        last_checked: now.toISOString(),
        response_time: probeResult.responseTime,
        error_message: null
      }).eq("id", m.id);
    } else {
      console.log(`Monitor ${m.id} (${m.url}) is DOWN. Reason: ${errorMessage}`);
      
      const shouldSendAlert = !m.last_alert_sent || 
        (now.getTime() - new Date(m.last_alert_sent).getTime()) > COOLDOWN_MINUTES * 60 * 1000;

      if (shouldSendAlert) {
        console.log(`Cooldown passed for ${m.id}. Sending alert.`);
        
        const resendApiKey = Deno.env.get("RESEND_API_KEY");
        if (m.notify_email && resendApiKey) {
          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${resendApiKey}` },
            body: JSON.stringify({
              from: "Mission Control <alerts@lovable.app>",
              to: [m.notify_email],
              subject: `🚨 Alert: Your mission "${m.name}" is DOWN`,
              html: `<p>Commander,</p><p>Our sensors show that your mission <strong>${m.name}</strong> (${m.url}) is unresponsive.</p><p>Reason: ${errorMessage}</p><p>We will continue to monitor the situation.</p><p>- OrbitPing Mission Control</p>`,
            }),
          });
          const responseBody = await res.json();
          console.log(`Resend API response for ${m.id}: ${res.status} ${JSON.stringify(responseBody)}`);
        }
        await supabase.from("monitors").update({ 
          status: "DOWN", last_checked: now.toISOString(), error_message: errorMessage,
          response_time: probeResult.responseTime, last_alert_sent: now.toISOString()
        }).eq("id", m.id);
      } else {
        console.log(`Monitor ${m.id} is down, but within cooldown. Skipping alert.`);
        await supabase.from("monitors").update({ 
          status: "DOWN", last_checked: now.toISOString(), error_message: errorMessage,
          response_time: probeResult.responseTime
        }).eq("id", m.id);
      }
    }
  });

  await Promise.all(checkPromises);
  return new Response("ok", { headers: { "Content-Type": "application/json" } });
});
