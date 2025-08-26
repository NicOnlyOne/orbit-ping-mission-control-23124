import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MonitorRow {
  id: string;
  user_id: string;
  name: string;
  url: string;
  status: "UP" | "DOWN" | "PENDING";
  last_alert_sent: string | null;
  last_checked: string | null;
}

console.log("--- FINAL: Edge function starting up ---");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { monitorId, url, forceAlert } = await req.json();
    
    // Create a Supabase client
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get monitor details
    let monitor: MonitorRow;
    if (monitorId) {
      const { data, error } = await supabase
        .from('monitors')
        .select('*')
        .eq('id', monitorId)
        .single();
      
      if (error || !data) {
        throw new Error(`Monitor not found: ${error?.message}`);
      }
      monitor = data;
    } else if (url) {
      // For direct URL testing (anonymous users)
      monitor = {
        id: 'anonymous',
        user_id: 'anonymous', 
        name: 'Anonymous Test',
        url: url,
        status: 'PENDING',
        last_alert_sent: null,
        last_checked: null
      };
    } else {
      throw new Error("Either monitorId or url must be provided");
    }

    console.log(`--- FINAL: Starting check for "${monitor.name}" (${monitor.url}) ---`);

    // Probe the URL
    const probeResult = await probeUrl(monitor.url);
    const nextStatus: "UP" | "DOWN" = probeResult.ok ? "UP" : "DOWN";
    const previousStatus = monitor.status;

    // Update monitor status if it's a real monitor (not anonymous)
    if (monitor.id !== 'anonymous') {
      await updateMonitorStatus(supabase, monitor.id, nextStatus);
      console.log(`--- FINAL: Database updated. Status: ${nextStatus}, Response Time: ${probeResult.responseTime || 0}ms ---`);

      // Get user email from profiles table
      const { data: profile } = await supabase
        .from('profiles')
        .select('email')
        .eq('user_id', monitor.user_id)
        .single();

      const userEmail = profile?.email;

      // Send alerts based on status changes and conditions
      if (userEmail && (forceAlert || shouldSendAlert(previousStatus, nextStatus, monitor.last_alert_sent))) {
        if (nextStatus === "DOWN") {
          console.log(`--- FINAL: Sending DOWN alert to ${userEmail} ---`);
          await sendAlert(userEmail, monitor, "DOWN", probeResult);
          await markLastAlertSent(supabase, monitor.id);
        } else if (nextStatus === "UP" && previousStatus === "DOWN") {
          console.log(`--- FINAL: Sending RECOVERY alert to ${userEmail} ---`);
          await sendAlert(userEmail, monitor, "RECOVERY", probeResult);
        }
      }
    }

    return new Response(JSON.stringify({ 
      status: nextStatus,
      responseTime: probeResult.responseTime,
      error: probeResult.error 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
    
  } catch (error) {
    console.error("--- FINAL: Error occurred:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

async function probeUrl(url: string): Promise<{ 
  ok: boolean; 
  status?: number; 
  error?: string; 
  responseTime?: number;
}> {
  const start = Date.now();
  try {
    const response = await fetch(url, { 
      method: "HEAD", 
      redirect: "follow",
      signal: AbortSignal.timeout(15000)
    });
    const responseTime = Date.now() - start;
    
    if (response.status >= 200 && response.status < 400) {
      return { ok: true, status: response.status, responseTime };
    } else {
      return { 
        ok: false, 
        status: response.status, 
        error: `HTTP ${response.status}`,
        responseTime 
      };
    }
  } catch (err) {
    const responseTime = Date.now() - start;
    return { 
      ok: false, 
      error: err.message,
      responseTime 
    };
  }
}

async function updateMonitorStatus(supabase: any, id: string, status: "UP" | "DOWN") {
  const { error } = await supabase
    .from('monitors')
    .update({ 
      status: status === "UP" ? "online" : "offline", 
      last_checked: new Date().toISOString() 
    })
    .eq('id', id);
    
  if (error) {
    console.error("Database update error:", error);
    throw new Error("Failed to update monitor status");
  }
}

async function markLastAlertSent(supabase: any, id: string) {
  const { error } = await supabase
    .from('monitors')
    .update({ last_alert_sent: new Date().toISOString() })
    .eq('id', id);
    
  if (error) {
    console.error("Mark alert sent error:", error);
  }
}

function shouldSendAlert(
  previousStatus: string, 
  currentStatus: "UP" | "DOWN", 
  lastAlertSent: string | null
): boolean {
  // Always send recovery emails when coming back online
  if (currentStatus === "UP" && previousStatus === "offline") {
    return true;
  }
  
  // For DOWN alerts, check cooldown (60 minutes = 3600000ms)
  if (currentStatus === "DOWN") {
    if (!lastAlertSent) return true;
    
    const cooldownMs = 60 * 60 * 1000; // 60 minutes
    const timeSinceAlert = Date.now() - new Date(lastAlertSent).getTime();
    return timeSinceAlert >= cooldownMs;
  }
  
  return false;
}

async function sendAlert(
  email: string, 
  monitor: MonitorRow, 
  type: "DOWN" | "RECOVERY",
  probeResult: any
): Promise<void> {
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) {
    console.error("RESEND_API_KEY not configured");
    return;
  }

  const isDown = type === "DOWN";
  const subject = isDown 
    ? `🚨 Mission Down: ${monitor.name}`
    : `✅ Mission Recovered: ${monitor.name}`;
    
  const bodyHtml = isDown ? `
    <h1>🚨 Houston, we have a problem!</h1>
    <p>Your mission <strong>${monitor.name}</strong> is currently offline.</p>
    <ul>
      <li><strong>URL:</strong> ${monitor.url}</li>
      <li><strong>Time:</strong> ${new Date().toUTCString()}</li>
      <li><strong>Error:</strong> ${probeResult.error || `HTTP ${probeResult.status}`}</li>
      <li><strong>Response Time:</strong> ${probeResult.responseTime || 0}ms</li>
    </ul>
    <p>Please investigate the status of your system.</p>
    <p><em>- OrbitPing Mission Control</em></p>
  ` : `
    <h1>✅ Mission Back Online!</h1>
    <p>Good news! Your mission <strong>${monitor.name}</strong> is back online.</p>
    <ul>
      <li><strong>URL:</strong> ${monitor.url}</li>
      <li><strong>Recovery Time:</strong> ${new Date().toUTCString()}</li>
      <li><strong>Response Time:</strong> ${probeResult.responseTime || 0}ms</li>
    </ul>
    <p>All systems are operational.</p>
    <p><em>- OrbitPing Mission Control</em></p>
  `;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Mission Control <onboarding@resend.dev>",
        to: [email],
        subject,
        html: bodyHtml,
      }),
    });

    if (response.ok) {
      console.log(`Alert sent successfully to ${email}`);
    } else {
      const error = await response.text();
      console.error(`Failed to send email: ${response.status} - ${error}`);
    }
  } catch (error) {
    console.error("Email sending error:", error);
  }
}