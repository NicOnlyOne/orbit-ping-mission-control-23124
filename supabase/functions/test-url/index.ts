// PASTE THIS CORRECTED CODE INTO: supabase/functions/test-url/index.ts

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TIMEOUT_MS = 15_000;

// This function probes the URL and returns its status
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
    // Ensure we capture the error message correctly
    const errorMessage = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      status: 0, // Indicates a network error, not an HTTP status
      error: errorMessage,
      responseTime
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { monitorId } = await req.json();
    if (!monitorId) throw new Error("monitorId is required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: monitor, error: fetchError } = await supabase.from("monitors").select("*").eq("id", monitorId).single();
    if (fetchError || !monitor) throw new Error(`Monitor not found: ${fetchError?.message}`);
    
    // --- THIS IS THE CRITICAL CHANGE ---
    // We await the probe and then decide what to do with the result.
    const probeResult = await probeUrl(monitor.url);
    const isUp = probeResult.ok;
    const errorMessage = isUp ? null : (probeResult.error || `HTTP ${probeResult.status}`);

    const updatePayload = {
      last_checked: new Date().toISOString(),
      status: isUp ? "UP" : "DOWN",
      response_time: probeResult.responseTime,
      error_message: errorMessage,
    };

    if (!isUp) {
      console.log(`Manual test for ${monitorId} is DOWN. Bypassing cooldown and sending alert.`);
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      if (monitor.notify_email && resendApiKey) {
        // Now, we await the email sending process
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: "Mission Control <alerts@lovable.app>",
            to: [monitor.notify_email],
            subject: `🚨 Alert: Your mission "${monitor.name}" is DOWN`,
            html: `<p>Commander,</p><p>A manual signal test for mission <strong>${monitor.name}</strong> (${monitor.url}) has failed.</p><p>Our sensors show it is unresponsive. Reason: ${errorMessage}</p><p>- OrbitPing Mission Control</p>`,
          }),
        });
        
        // And we log the result from Resend
        const responseBody = await res.json();
        console.log(`Resend API response: ${res.status} ${JSON.stringify(responseBody)}`);
      }
    }
    
    await supabase.from("monitors").update(updatePayload).eq("id", monitorId);

    return new Response(JSON.stringify({ status: isUp ? 'online' : 'offline', responseTime: probeResult.responseTime }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "An unknown error occurred";
    console.error("Error in test-url function:", errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
