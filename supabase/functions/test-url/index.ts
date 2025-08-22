// PASTE THIS FINAL CODE INTO: supabase/functions/test-url/index.ts

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { monitorId } = body;

    if (!monitorId) {
      throw new Error("monitorId is required");
    }

    // GET SECRETS FIRST
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    // ADD EXPLICIT CHECK FOR THE RESEND KEY
    if (!resendApiKey) {
      console.error("CRITICAL: RESEND_API_KEY secret is not set in Supabase project settings.");
      throw new Error("Email sending is not configured. RESEND_API_KEY secret is missing.");
    }
    
    const supabase = createClient(supabaseUrl!, supabaseServiceRoleKey!);

    const { data: monitor, error: fetchError } = await supabase.from("monitors").select("*").eq("id", monitorId).single();
    if (fetchError || !monitor) {
      throw new Error(`Monitor not found: ${fetchError?.message}`);
    }
    
    const probeResult = await probeUrl(monitor.url);
    const isUp = probeResult.ok;
    const errorMessage = isUp ? null : (probeResult.error || `HTTP ${probeResult.status}`);
    
    const updatePayload = {
      last_checked: new Date().toISOString(),
      status: isUp ? "UP" : "DOWN",
      response_time: probeResult.responseTime,
      error_message: errorMessage,
    };

    if (!isUp && monitor.notify_email) {
      console.log(`Site is DOWN. Sending email to ${monitor.notify_email} via Resend.`);
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
      status: 500,
    });
  }
});
