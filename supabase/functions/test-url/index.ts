import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";
import { corsHeaders } from "../_shared/cors.ts";

// =================================
// Types and Constants
// =================================

// The table in your database that stores the monitors
const TABLE_MONITORS = "monitors";

// A "MonitorRow" represents a single monitor (a single row in your table)
interface MonitorRow {
  id: string;
  user_id: string;
  name: string;
  url: string;
  status: "UP" | "DOWN" | "PENDING";
  last_alert_sent: string | null;
  notify_email: string | null;
}

// =================================
// Main Function Logic
// =================================

console.log("--- Edge function starting up ---");

Deno.serve(async (req) => {
  // This part handles the "Test Signal" button click from the browser
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { monitorId } = await req.json();
    if (!monitorId) throw new Error("Missing monitorId in request body");

    console.log(`--- Received test request for monitor: ${monitorId} ---`);

    // Create a Supabase client to talk to the database
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );

    // 1. Get the monitor's details from the database
    const { data: monitor, error: fetchError } = await supabase
      .from(TABLE_MONITORS)
      .select("*")
      .eq("id", monitorId)
      .single();

    if (fetchError || !monitor) {
      throw new Error(`Failed to fetch monitor or monitor not found: ${fetchError?.message || 'Not Found'}`);
    }

    console.log(`--- Checking URL: ${monitor.url} for monitor "${monitor.name}" ---`);

    // 2. Check if the website is actually up or down
    const probeResult = await probeUrl(monitor.url);

    // 3. Update the database with the result
    const nextStatus = probeResult.ok ? "UP" : "DOWN";
    await updateMonitorStatus(supabase, monitor.id, nextStatus);

    console.log(`--- Probe result for ${monitor.name}: ${nextStatus} ---`);

    // 4. If the site is DOWN, send an email alert
    if (nextStatus === "DOWN") {
      console.log(`--- Status is DOWN. Preparing to send alert for ${monitor.name}. ---`);
      
      const emailResult = await invokeSendEmail({
        monitor: monitor,
        type: "DOWN",
        probeResult: probeResult,
      });

      if (emailResult.ok) {
        // If email was sent, mark it in the database to avoid spamming
        await markLastAlertSent(supabase, monitor.id);
        console.log(`--- Alert email sent and timestamp updated for ${monitor.name}. ---`);
      } else {
        console.error(`--- Failed to send alert email for ${monitor.name}. ---`);
      }
    }

    return new Response(JSON.stringify({ status: nextStatus }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("---!!!--- An error occurred in the main function: ", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});


// =================================
// Helper Functions
// =================================

/**
 * Checks if a URL is reachable.
 * Returns { ok: true } for success, or { ok: false, error, status } for failure.
 */
async function probeUrl(url: string): Promise<{ ok: boolean; status?: number; error?: string }> {
  try {
    const response = await fetch(url, { method: "HEAD", redirect: "follow" });
    if (response.status >= 200 && response.status < 400) {
      return { ok: true, status: response.status };
    } else {
      return { ok: false, status: response.status, error: `HTTP status ${response.status}` };
    }
  } catch (err) {
    // This catches network errors, like the server being completely offline
    return { ok: false, error: err.message };
  }
}

/**
 * Updates the monitor's status in the database.
 */
async function updateMonitorStatus(supabase: any, id: string, nextStatus: "UP" | "DOWN") {
  const { error } = await supabase
    .from(TABLE_MONITORS)
    .update({ status: nextStatus, last_checked: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    console.error("Database update error:", error);
    throw new Error("Failed to update monitor status in database.");
  }
}

/**
 * Records the time an alert was sent to prevent sending too many emails.
 */
async function markLastAlertSent(supabase: any, id:string) {
  const { error } = await supabase
    .from(TABLE_MONITORS)
    .update({ last_alert_sent: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    console.error("Mark alert sent error:", error);
  }
}

/**
 * Sends the actual email alert using Resend.com
 */
async function invokeSendEmail(args: {
  monitor: MonitorRow;
  type: "DOWN";
  probeResult: { ok: boolean; status?: number; error?: string };
}): Promise<{ ok: boolean }> {
  const to = args.monitor.notify_email;
  if (!to) {
    console.warn(`Monitor ${args.monitor.id} has no notify_email; skipping email.`);
    return { ok: true }; // Not an error, just skipping
  }

  // Securely get the API key from Supabase Secrets
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) {
    console.error("!!! CRITICAL: RESEND_API_KEY is not set in Supabase secrets. Cannot send email.");
    return { ok: false };
  }

  const subject = `🚨 [Orbit Ping] Mission Down: ${args.monitor.name}`;
  const bodyHtml = `
    <h1>Houston, we have a problem!</h1>
    <p>Your mission <strong>${args.monitor.name}</strong> is currently offline.</p>
    <ul>
      <li><strong>URL:</strong> ${args.monitor.url}</li>
      <li><strong>Time of Alert:</strong> ${new Date().toUTCString()}</li>
      <li><strong>Detected Error:</strong> ${args.probeResult.error || `Received HTTP Status ${args.probeResult.status}`}</li>
    </ul>
    <p>Please investigate the status of the target system.</p>
    <p><em>- Orbit Ping Mission Control</em></p>
  `;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Orbit Ping <onboarding@resend.dev>", // This is a special address that works for testing
        to: to,
        subject: subject,
        html: bodyHtml,
      }),
    });

    if (res.ok) {
      console.log(`Alert email sent successfully to ${to} for monitor ${args.monitor.id}`);
      return { ok: true };
    } else {
      const errorBody = await res.json();
      console.error(`Failed to send email via Resend. Status: ${res.status}`, errorBody);
      return { ok: false };
    }
  } catch (error) {
    console.error("An unexpected error occurred while sending the email:", error);
    return { ok: false };
  }
}
