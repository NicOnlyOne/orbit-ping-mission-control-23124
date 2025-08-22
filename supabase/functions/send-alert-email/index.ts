// PASTE THIS CORRECTED CODE INTO: supabase/functions/send-alert-email/index.ts

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

// --- Config ---
const COOLDOWN_MINUTES = 60; // How many minutes to wait before sending another alert for the same site
const TIMEOUT_MS = 15_000; // 15 seconds

// --- Types ---
type Monitor = {
  id: string;
  name: string;
  url: string;
  status: "UP" | "DOWN" | null;
  last_alert_sent: string | null;
  notify_email: string | null;
};

// --- Helper to check a URL ---
async function probeUrl(url: string) {
  const startTime = Date.now();
  try {
    const response = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(TIMEOUT_MS) });
    const responseTime = Date.now() - startTime;
    return {
      status: response.ok ? "UP" : "DOWN",
      message: `HTTP ${response.status}`,
      responseTime
    } as const;
  } catch (err) {
    const responseTime = Date.now() - startTime;
    return {
      status: "DOWN",
      message: err.message,
      responseTime
    } as const;
  }
}

// --- Main Function ---
Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // 1. Fetch all monitors
  const { data: monitors, error: fetchError } = await supabase
    .from("monitors")
    .select<"*", Monitor>("id, name, url, status, last_alert_sent, notify_email");

  if (fetchError) {
    console.error("Error fetching monitors:", fetchError.message);
    return new Response("Error fetching monitors", { status: 500 });
  }

  const now = new Date();
  
  // 2. Check each monitor
  const checkPromises = monitors.map(async (m) => {
    const probe = await probeUrl(m.url);

    if (probe.status === "UP") {
       // If the site was previously down, mark it as up. Otherwise, just update check time.
      if (m.status === "DOWN") {
        console.log(`Monitor ${m.id} (${m.url}) is back UP.`);
      }
      await supabase.from("monitors").update({
        status: "UP",
        last_checked: now.toISOString(),
        response_time: probe.responseTime,
        error_message: null
      }).eq("id", m.id);
    } else {
      // Monitor is DOWN
      console.log(`Monitor ${m.id} (${m.url}) is DOWN. Reason: ${probe.message}`);
      
      const shouldSendAlert = !m.last_alert_sent || 
        (new Date().getTime() - new Date(m.last_alert_sent).getTime()) > COOLDOWN_MINUTES * 60 * 1000;

      if (shouldSendAlert) {
        console.log(`Cooldown passed for ${m.id}. Sending alert.`);
        
        // --- Directly Send Email Here ---
        const resendApiKey = Deno.env.get("RESEND_API_KEY");
        if (m.notify_email && resendApiKey) {
          fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${resendApiKey}`,
            },
            body: JSON.stringify({
              from: "Mission Control <alerts@lovable.app>",
              to: [m.notify_email],
              subject: `🚨 Alert: Your mission "${m.name}" is DOWN`,
              html: `<p>Commander,</p><p>Our sensors show that your mission <strong>${m.name}</strong> (${m.url}) is unresponsive.</p><p>We will continue to monitor the situation.</p><p>- OrbitPing Mission Control</p>`,
            }),
          });
        }
        // --- End of Email Logic ---

        // Update status and the alert timestamp
        await supabase.from("monitors").update({ 
          status: "DOWN", 
          last_checked: now.toISOString(),
          error_message: probe.message,
          response_time: probe.responseTime,
          last_alert_sent: now.toISOString() // Mark that we just sent an alert
        }).eq("id", m.id);

      } else {
        console.log(`Monitor ${m.id} is down, but within cooldown. Skipping alert.`);
        // Update status but NOT the alert timestamp
        await supabase.from("monitors").update({ 
          status: "DOWN", 
          last_checked: now.toISOString(),
          error_message: probe.message,
          response_time: probe.responseTime
        }).eq("id", m.id);
      }
    }
  });

  await Promise.all(checkPromises);
  return new Response("ok", { headers: { "Content-Type": "application/json" } });
});
