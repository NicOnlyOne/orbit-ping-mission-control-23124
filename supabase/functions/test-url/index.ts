// PASTE THIS CORRECTED CODE INTO: supabase/functions/test-url/index.ts

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TIMEOUT_MS = 15_000;

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


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { monitorId } = await req.json();
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: monitor, error: fetchError } = await supabase.from("monitors").select("*").eq("id", monitorId).single();
    if (fetchError || !monitor) throw new Error("Monitor not found");

    const probe = await probeUrl(monitor.url);
    const updatePayload = {
      last_checked: new Date().toISOString(),
      status: probe.status,
      response_time: probe.responseTime,
      error_message: probe.message,
    };
    
    if (probe.status !== 'UP') {
        console.log(`Manual test for ${monitorId} is DOWN. Bypassing cooldown and sending alert.`);
        const resendApiKey = Deno.env.get("RESEND_API_KEY");
        if (monitor.notify_email && resendApiKey) {
          // --- THIS IS THE MODIFIED PART ---
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
              html: `<p>Commander,</p><p>A manual signal test for mission <strong>${monitor.name}</strong> (${monitor.url}) has failed.</p><p>Our sensors show it is unresponsive.</p><p>- OrbitPing Mission Control</p>`,
            }),
          });
          // Add logging to see the result
          console.log(`Resend API response status: ${res.status}`);
          const responseBody = await res.json();
          console.log(`Resend API response body: ${JSON.stringify(responseBody)}`);
          // --- END OF MODIFICATION ---
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
