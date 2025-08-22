// PASTE THIS DEBUGGING CODE INTO: supabase/functions/test-url/index.ts

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TIMEOUT_MS = 15_000;

async function probeUrl(url: string) {
  // ... (probeUrl function remains the same as before) ...
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

console.log("Function script loaded. Deno.serve starting.");

Deno.serve(async (req) => {
  console.log("Request received. Method:", req.method);

  if (req.method === "OPTIONS") {
    console.log("Handling OPTIONS request.");
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log("Inside main try block. About to parse JSON.");
    const body = await req.json();
    const monitorId = body.monitorId;
    console.log("JSON parsed successfully. Monitor ID:", monitorId);

    if (!monitorId) {
      console.error("Error: monitorId is missing from request body.");
      throw new Error("monitorId is required");
    }

    console.log("Creating Supabase client.");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    console.log("Supabase client created.");

    console.log(`Fetching monitor ${monitorId} from database.`);
    const { data: monitor, error: fetchError } = await supabase.from("monitors").select("*").eq("id", monitorId).single();
    if (fetchError || !monitor) {
      console.error("Error fetching monitor:", fetchError?.message);
      throw new Error(`Monitor not found: ${fetchError?.message}`);
    }
    console.log("Monitor data fetched successfully.");
    
    console.log(`Probing URL: ${monitor.url}`);
    const probeResult = await probeUrl(monitor.url);
    const isUp = probeResult.ok;
    const errorMessage = isUp ? null : (probeResult.error || `HTTP ${probeResult.status}`);
    console.log(`Probe complete. Status is ${isUp ? 'UP' : 'DOWN'}.`);

    const updatePayload = {
      last_checked: new Date().toISOString(),
      status: isUp ? "UP" : "DOWN",
      response_time: probeResult.responseTime,
      error_message: errorMessage,
    };

    if (!isUp) {
      console.log(`Site is DOWN. Preparing to send alert for ${monitorId}.`);
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      if (monitor.notify_email && resendApiKey) {
        console.log(`Sending email to ${monitor.notify_email} via Resend.`);
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${resendApiKey}` },
          body: JSON.stringify({
            from: "Mission Control <alerts@lovable.app>",
            to: [monitor.notify_email],
            subject: `🚨 Alert: Your mission "${monitor.name}" is DOWN`,
            html: `<p>Commander,</p><p>A manual signal test for mission <strong>${monitor.name}</strong> (${monitor.url}) has failed.</p><p>Reason: ${errorMessage}</p><p>- OrbitPing Mission Control</p>`,
          }),
        });
        
        const responseBody = await res.json();
        console.log(`Resend API response: ${res.status} ${JSON.stringify(responseBody)}`);
      }
    }
    
    console.log(`Updating monitor ${monitorId} in database.`);
    await supabase.from("monitors").update(updatePayload).eq("id", monitorId);
    console.log("Database update complete.");

    return new Response(JSON.stringify({ status: isUp ? 'online' : 'offline', responseTime: probeResult.responseTime }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "An unknown error occurred";
    console.error("CRITICAL ERROR in catch block:", errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500, // Use 500 for server-side errors
    });
  }
});
