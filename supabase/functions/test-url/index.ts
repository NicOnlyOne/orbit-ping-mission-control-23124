// PASTE THIS FINAL CODE INTO: supabase/functions/test-url/index.ts

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";
import { Resend } from "https://esm.sh/resend@3.2.0";

// Define the structure of a monitor from our database
type Monitor = {
  id: string;
  name: string;
  url: string;
  status?: "UP" | "DOWN" | null;
  last_alert_sent?: string | null;
  notify_email?: string | null;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// --- CONFIGURATION ---
const TIMEOUT_MS = 15_000;
const COOLDOWN_MINUTES = 60; // How long to wait before sending another DOWN alert for the same site

// --- SECRETS (Ensure these are set in your Supabase Project Dashboard) ---
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { monitorId } = await req.json();
    if (!monitorId) throw new Error("Missing monitorId in request body.");
    
    // Initialize clients
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const resend = new Resend(RESEND_API_KEY);

    // 1. Fetch monitor details from the database
    const { data: monitor, error: dbError } = await supabase
      .from("monitors")
      .select("*")
      .eq("id", monitorId)
      .single();

    if (dbError) throw new Error(`Database error: ${dbError.message}`);
    if (!monitor) throw new Error(`Monitor with ID ${monitorId} not found.`);

    console.log(`--- FINAL: Starting check for "${monitor.name}" (${monitor.url}) ---`);

    // 2. Probe the target URL
    const probeResult = await probeUrl(monitor.url);

    // 3. Update the database with the result
    await supabase
      .from("monitors")
      .update({
        status: probeResult.status,
        response_time: probeResult.responseTime,
        error_message: probeResult.errorMessage,
        last_checked: new Date().toISOString(),
      })
      .eq("id", monitor.id);

    console.log(`--- FINAL: Database updated. Status: ${probeResult.status}, Response Time: ${probeResult.responseTime}ms ---`);

    // 4. Send alert if the site is DOWN and cooldown has passed
    if (probeResult.status === "DOWN") {
      const shouldSendAlert = !monitor.last_alert_sent || 
        (new Date().getTime() - new Date(monitor.last_alert_sent).getTime() > COOLDOWN_MINUTES * 60 * 1000);

      if (monitor.notify_email && shouldSendAlert) {
        console.log(`--- FINAL: Sending DOWN alert to ${monitor.notify_email} ---`);
        await sendDownAlert(resend, monitor, probeResult.errorMessage);
        // Update the last_alert_sent timestamp in the DB
        await supabase
          .from("monitors")
          .update({ last_alert_sent: new Date().toISOString() })
          .eq("id", monitor.id);
      } else {
         console.log(`--- FINAL: DOWN status detected, but alert cooldown is active or no email is set. ---`);
      }
    }

    return new Response(JSON.stringify({
      status: probeResult.status,
      message: `Check complete for ${monitor.name}. Status: ${probeResult.status}.`
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("--- FINAL: CRITICAL ERROR ---", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// Helper function to check a URL
async function probeUrl(url: string): Promise<{ status: "UP" | "DOWN"; responseTime: number; errorMessage: string | null; }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  
  try {
    const startTime = Date.now();
    const response = await fetch(url, { signal: controller.signal });
    const endTime = Date.now();
    
    clearTimeout(timeoutId);

    if (response.ok) {
      return { status: "UP", responseTime: endTime - startTime, errorMessage: null };
    } else {
      return { status: "DOWN", responseTime: endTime - startTime, errorMessage: `HTTP Error: Status ${response.status}` };
    }
  } catch (error) {
    clearTimeout(timeoutId);
    return { status: "DOWN", responseTime: 0, errorMessage: error.message };
  }
}

// Helper function to send email alert
async function sendDownAlert(resend: Resend, monitor: Monitor, errorMessage: string | null) {
  const subject = `🚨 Alert: Your Mission "${monitor.name}" is Down!`;
  const body = `
    <p>Houston, we have a problem.</p>
    <p>Our monitoring systems have detected that your mission, <strong>${monitor.name}</strong>, is currently down.</p>
    <ul>
      <li><strong>URL:</strong> <a href="${monitor.url}">${monitor.url}</a></li>
      <li><strong>Time of Detection:</strong> ${new Date().toUTCString()}</li>
      <li><strong>Error Details:</strong> ${errorMessage || "No specific error message was returned."}</li>
    </ul>
    <p>Please investigate the issue immediately.</p>
    <p><em>Orbit Ping Mission Control</em></p>
  `;

  await resend.emails.send({
    from: "Mission Control <alerts@yourdomain.com>", // IMPORTANT: Change to your verified Resend domain
    to: monitor.notify_email!,
    subject: subject,
    html: body,
  });
}
