import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";
// Removed the Resend SDK to avoid Node-only code in Edge/Deno

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type AlertPayload = {
  // Accept broader inputs; we normalize below
  type: "DOWN" | "UP" | string;
  monitor: { id: string; name: string; url: string };
  to?: string;
  user_id?: string;
  probe?: { ok: boolean; status: number; ms: number; error?: string };
  incident_id?: string | null;
  occurred_at?: string;
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
// Safe default for testing; replace with your verified sender when ready
const RESEND_FROM = Deno.env.get("RESEND_FROM") || "OrbitPing Alerts <onboarding@resend.dev>";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

function normalizeType(input: string | undefined): "DOWN" | "UP" {
  const t = (input ?? "").toUpperCase();
  if (["DOWN", "OFFLINE", "ERROR", "FAILED", "FAIL"].includes(t)) return "DOWN";
  // default to UP when ambiguous; adjust if you prefer "DOWN"
  return "UP";
}

function subjectFor(p: AlertPayload) {
  const t = normalizeType(p.type);
  return t === "DOWN"
    ? `🚨 ALERT: ${p.monitor.name} is DOWN`
    : `✅ RESOLVED: ${p.monitor.name} is back UP`;
}

function htmlFor(p: AlertPayload) {
  const t = normalizeType(p.type);
  const probe = p.probe;
  const when = p.occurred_at ?? new Date().toISOString();
  const statusLine =
    t === "DOWN"
      ? `Service appears DOWN (HTTP ${probe?.status ?? "—"}).`
      : `Service appears UP (HTTP ${probe?.status ?? "—"}).`;
  const err = probe?.error
    ? `<pre style="white-space:pre-wrap;background:#f3f4f6;padding:8px;border-radius:4px">${probe.error}</pre>`
    : "";
  const statusColor = t === "DOWN" ? "#ef4444" : "#10b981";

  return `
  <div style="font-family:Inter,system-ui,Segoe UI,Arial,sans-serif;padding:24px;max-width:600px;margin:0 auto">
    <div style="background:${statusColor};color:white;padding:16px;border-radius:8px;margin-bottom:24px">
      <h1 style="margin:0;font-size:24px">${t === "DOWN" ? "🚨" : "✅"} ${t === "DOWN" ? "ALERT" : "RESOLVED"}</h1>
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
    const { data: profile } = await supabase
      .from("profiles")
      .select("email")
      .eq("user_id", user_id)
      .maybeSingle();

    if (profile?.email) return profile.email;

    const {
      data: { user },
      error,
    } = await supabase.auth.admin.getUserById(user_id);
    if (!error && user?.email) return user.email;

    return null;
  } catch (error) {
    console.error("Error fetching user email:", error);
    return null;
  }
}

// Edge/Deno-safe Resend call
async function sendWithResend({
  apiKey,
  from,
  to,
  subject,
  html,
}: {
  apiKey: string;
  from: string;
  to: string | string[];
  subject: string;
  html: string;
}) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, html }),
  });

  const text = await res.text();
  let parsed: any = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    /* noop */
  }

  console.log("Resend HTTP:", res.status, res.statusText);
  if (!res.ok) {
    console.error("Resend error body:", parsed ?? text);
    throw new Error(parsed?.error?.message ?? text ?? `HTTP ${res.status}`);
  }

  console.log("Resend success body:", parsed);
  return parsed; // typically { id: "..." }
}

async function sendEmail(payload: AlertPayload): Promise<any> {
  // Determine recipient
  let recipientEmail = payload.to;
  if (!recipientEmail && payload.user_id) {
    recipientEmail = await getRecipientEmail(payload.user_id);
  }
  if (!recipientEmail) {
    throw new Error("No recipient email available");
  }

  const normType = normalizeType(payload.type);
  console.log(`Sending ${normType} alert for ${payload.monitor.name} to ${recipientEmail}`);

  const emailData = {
    from: RESEND_FROM,
    to: recipientEmail,
    subject: subjectFor(payload),
    html: htmlFor(payload),
  };

  // Visibility for debugging
  console.log("Email payload preview (without HTML):", {
    from: emailData.from,
    to: emailData.to,
    subject: emailData.subject,
    type: normType,
  });

  const result = await sendWithResend({
    apiKey: RESEND_API_KEY,
    from: emailData.from,
    to: emailData.to,
    subject: emailData.subject,
    html: emailData.html,
  });

  return result;
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
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
      headers: corsHeaders,
    });
  }

  // Env checks (log lengths to ensure they are actually loaded)
  if (!RESEND_API_KEY) {
    console.error("Missing RESEND_API_KEY");
    return new Response("Server misconfigured (RESEND_API_KEY missing)", {
      status: 500,
      headers: corsHeaders,
    });
  }
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    console.error("Missing Supabase service envs");
    return new Response("Server misconfigured (Supabase envs)", {
      status: 500,
      headers: corsHeaders,
    });
  }

  // Payload checks
  if (!payload?.monitor?.url || !payload?.type) {
    console.error("Missing required fields:", {
      monitor_url: payload?.monitor?.url,
      type: payload?.type,
    });
    return new Response("Missing required fields (monitor.url, type)", {
      status: 400,
      headers: corsHeaders,
    });
  }

  // Require a way to find recipient
  if (!payload.to && !payload.user_id) {
    console.error("No recipient email or user_id provided");
    return new Response("No recipient email or user_id provided", {
      status: 400,
      headers: corsHeaders,
    });
  }

  try {
    const result = await sendEmail(payload);
    const id = result?.id ?? result?.data?.id ?? null;

    return new Response(
      JSON.stringify({
        ok: true,
        id,
        email_sent_to: payload.to || "user_email_from_db",
      }),
      {
        headers: {
          "content-type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("Email send failed:", error?.message || error);
    return new Response(
      JSON.stringify({
        error: `Email send failed: ${error?.message || error}`,
      }),
      {
        status: 500,
        headers: {
          "content-type": "application/json",
          ...corsHeaders,
        },
      }
    );
  }
});
