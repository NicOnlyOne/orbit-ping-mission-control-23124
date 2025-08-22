import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type AlertPayload = {
  type: "DOWN" | "UP";
  monitor: { id: string; name: string; url: string };
  to?: string;
  user_id?: string;
  probe?: { ok: boolean; status: number; ms: number; error?: string };
  incident_id?: string | null;
  occurred_at?: string;
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const RESEND_FROM = Deno.env.get("RESEND_FROM")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const resend = new Resend(RESEND_API_KEY);

function subjectFor(p: AlertPayload) {
  return p.type === "DOWN"
    ? `🚨 ALERT: ${p.monitor.name} is DOWN`
    : `✅ RESOLVED: ${p.monitor.name} is back UP`;
}

function htmlFor(p: AlertPayload) {
  const probe = p.probe;
  const when = p.occurred_at ?? new Date().toISOString();
  const statusLine =
    p.type === "DOWN"
      ? `Service appears DOWN (HTTP ${probe?.status ?? "—"}).`
      : `Service appears UP (HTTP ${probe?.status ?? "—"}).`;
  const err = probe?.error ? `<pre style="white-space:pre-wrap;background:#f3f4f6;padding:8px;border-radius:4px">${probe.error}</pre>` : "";
  const statusColor = p.type === "DOWN" ? "#ef4444" : "#10b981";
  
  return `
  <div style="font-family:Inter,system-ui,Segoe UI,Arial,sans-serif;padding:24px;max-width:600px;margin:0 auto">
    <div style="background:${statusColor};color:white;padding:16px;border-radius:8px;margin-bottom:24px">
      <h1 style="margin:0;font-size:24px">${p.type === "DOWN" ? "🚨" : "✅"} ${p.type === "DOWN" ? "ALERT" : "RESOLVED"}</h1>
      <p style="margin:8px 0 0;font-size:18px;opacity:0.9">${p.monitor.name}</p>
    </div>
    
    <div style="background:#f9fafb;padding:20px;border-radius:8px;margin-bottom:20px">
      <p style="margin:0 0 12px;font-size:16px"><strong>URL:</strong> <a href="${p.monitor.url}" style="color:#2563eb">${p.monitor.url}</a></p>
      <p style="margin:0 0 12px"><strong>Time:</strong> ${new Date(when).toLocaleString()}</p>
      <p style="margin:0 0 12px"><strong>Status:</strong> ${statusLine}</p>
      <p style="margin:0"><strong>Response Time:</strong> ${probe?.ms ?? "—"} ms</p>
    </div>
    
    ${err}
    ${p.incident_id ? `<p style="margin:16px 0"><strong>Incident ID:</strong> ${p.incident_id}</p>` : ""}
    
    <hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb" />
    <p style="color:#6b7280;font-size:14px;margin:0">You are receiving this because you monitor ${p.monitor.name}. This is an automated alert from OrbitPing.</p>
  </div>`;
}

async function getRecipientEmail(user_id: string): Promise<string | null> {
  if (!user_id) return null;
  
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  
  try {
    // First try to get email from profiles table
    const { data: profile } = await supabase
      .from("profiles")
      .select("email")
      .eq("user_id", user_id)
      .maybeSingle();
    
    if (profile?.email) return profile.email;
    
    // If not in profiles, get from auth.users (using admin API)
    const { data: { user }, error } = await supabase.auth.admin.getUserById(user_id);
    if (!error && user?.email) return user.email;
    
    return null;
  } catch (error) {
    console.error("Error fetching user email:", error);
    return null;
  }
}

async function sendEmail(payload: AlertPayload): Promise<any> {
  let recipientEmail = payload.to;
  
  // If no email provided, try to get it from user_id
  if (!recipientEmail && payload.user_id) {
    recipientEmail = await getRecipientEmail(payload.user_id);
  }
  
  if (!recipientEmail) {
    throw new Error("No recipient email available");
  }

  console.log(`Sending ${payload.type} alert for ${payload.monitor.name} to ${recipientEmail}`);
  
  const emailData = {
    from: RESEND_FROM,
    to: [recipientEmail],
    subject: subjectFor(payload),
    html: htmlFor(payload),
  };

  const result = await resend.emails.send(emailData);
  console.log("Email sent successfully:", result);
  return result;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("send-alert-email function invoked");

  let payload: AlertPayload | null = null;
  try {
    payload = (await req.json()) as AlertPayload;
    console.log("Received payload:", JSON.stringify(payload, null, 2));
  } catch (error) {
    console.error("Invalid JSON body:", error);
    return new Response("Invalid JSON body", { 
      status: 400,
      headers: corsHeaders
    });
  }

  // Check required environment variables
  if (!RESEND_API_KEY || !RESEND_FROM) {
    console.error("Missing RESEND secrets - RESEND_API_KEY:", !!RESEND_API_KEY, "RESEND_FROM:", !!RESEND_FROM);
    return new Response("Server misconfigured (RESEND secrets)", { 
      status: 500,
      headers: corsHeaders
    });
  }

  // Validate required payload fields
  if (!payload?.monitor?.url || !payload?.type) {
    console.error("Missing required fields:", {
      monitor_url: payload?.monitor?.url,
      type: payload?.type
    });
    return new Response("Missing required fields (monitor.url, type)", { 
      status: 400,
      headers: corsHeaders
    });
  }

  // Validate we have a way to get recipient email
  if (!payload.to && !payload.user_id) {
    console.error("No recipient email or user_id provided");
    return new Response("No recipient email or user_id provided", { 
      status: 400,
      headers: corsHeaders
    });
  }

  try {
    console.log(`Processing ${payload.type} alert for monitor: ${payload.monitor.name}`);
    const result = await sendEmail(payload);
    
    console.log("Email sent successfully:", result);
    return new Response(JSON.stringify({ 
      ok: true, 
      id: result?.data?.id ?? result?.id ?? null,
      email_sent_to: payload.to || "user_email_from_db"
    }), {
      headers: { 
        "content-type": "application/json",
        ...corsHeaders
      },
    });
  } catch (error: any) {
    console.error("Email send failed:", error?.message || error);
    return new Response(JSON.stringify({ 
      error: `Email send failed: ${error?.message || error}` 
    }), { 
      status: 500,
      headers: {
        "content-type": "application/json",
        ...corsHeaders
      }
    });
  }
});
