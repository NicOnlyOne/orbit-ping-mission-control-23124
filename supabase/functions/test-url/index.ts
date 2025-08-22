// PASTE THIS CODE INTO: supabase/functions/test-url/index.ts

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// --- Main Function ---
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { monitorId } = await req.json();
    if (!monitorId) throw new Error("Missing monitorId in request body");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Get the specific monitor
    const { data: monitor, error: fetchError } = await supabase
      .from("monitors")
      .select("*")
      .eq("id", monitorId)
      .single();

    if (fetchError) throw new Error(`Monitor not found: ${fetchError.message}`);

    // 2. Probe the URL
    const startTime = Date.now();
    let probe: { status: "UP" | "DOWN"; message: string; responseTime: number };

    try {
      const response = await fetch(monitor.url, { method: "HEAD", signal: AbortSignal.timeout(10000) });
      const responseTime = Date.now() - startTime;
      probe = response.ok 
        ? { status: "UP", message: `HTTP ${response.status}`, responseTime }
        : { status: "DOWN", message: `HTTP ${response.status}`, responseTime };
    } catch (err) {
      const responseTime = Date.now() - startTime;
      probe = { status: "DOWN", message: err.message, responseTime };
    }

    // 3. Update the database
    const updatePayload = {
      status: probe.status,
      last_checked: new Date().toISOString(),
      response_time: probe.responseTime,
      error_message: probe.status === 'DOWN' ? probe.message : null,
    };

    // 4. If it's down, send an email IMMEDIATELY (no cooldown)
    if (probe.status === "DOWN") {
      console.log(`Manual test for ${monitor.id} is DOWN. Bypassing cooldown and sending alert.`);
      
      updatePayload.last_alert_sent = new Date().toISOString(); // Also update the alert time

      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      if (monitor.notify_email && resendApiKey) {
        fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${resendApiKey}`,
            },
            body: JSON.stringify({
              from: "Mission Control <alerts@lovable.app>",
              to: [monitor.notify_email],
              subject: `🚨 Alert: Your mission "${monitor.name}" is DOWN`,
              html: `<p>Commander,</p><p>A manual signal test for mission <strong>${monitor.name}</strong> (${monitor.url}) has failed.</p><p>Our sensors show it is unresponsive.</p><p>- OrbitPing Mission Control</p>`,
            }),
          });
      }
    }
    
    const { error: updateError } = await supabase.from("monitors").update(updatePayload).eq("id", monitorId);
    if (updateError) throw new Error(`DB update failed: ${updateError.message}`);

    return new Response(JSON.stringify({ status: probe.status === 'UP' ? 'online' : 'offline', responseTime: probe.responseTime }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(String(err?.message ?? err), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
