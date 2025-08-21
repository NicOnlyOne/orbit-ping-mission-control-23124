import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend";

// Types
interface AlertPayload {
  monitorId: string;
  monitorName: string;
  monitorUrl: string;
  errorMessage?: string | null;
  statusCode?: number;
}

Deno.serve(async (req) => {
  try {
    const body: AlertPayload = await req.json();

    if (!body.monitorId || !body.monitorName || !body.monitorUrl) {
      return new Response(JSON.stringify({ error: "Missing fields" }), {
        status: 400,
      });
    }

    // Env vars
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY")!;

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const resend = new Resend(resendApiKey);

    // Get user email from monitor’s owner
    const { data: monitor, error: monitorErr } = await supabase
      .from("monitors")
      .select("id, user_id")
      .eq("id", body.monitorId)
      .single();

    if (monitorErr || !monitor) {
      console.error("❌ Monitor lookup failed:", monitorErr);
      return new Response(JSON.stringify({ error: "Monitor not found" }), {
        status: 404,
      });
    }

    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", monitor.user_id)
      .single();

    if (profileErr || !profile?.email) {
      console.error("❌ Profile lookup failed:", profileErr);
      return new Response(JSON.stringify({ error: "No recipient" }), {
        status: 404,
      });
    }

    const toEmail = profile.email;

    // Build email content
    const subject = `🚨 ${body.monitorName} is DOWN`;
    const message = `
      <h2>Alert: ${body.monitorName} is offline</h2>
      <p><strong>URL:</strong> ${body.monitorUrl}</p>
      <p><strong>Error:</strong> ${body.errorMessage || "Unknown"}</p>
      ${
        body.statusCode
          ? `<p><strong>Status Code:</strong> ${body.statusCode}</p>`
          : ""
      }
      <p><strong>Time:</strong> ${new Date().toISOString()}</p>
    `;

    // Try sending via Resend
    let sendSuccess = false;
    let sendError: string | null = null;

    try {
      await resend.emails.send({
        from: "alerts@yourdomain.com", // ✅ Replace with your verified sender in Resend
        to: toEmail,
        subject,
        html: message,
      });
      sendSuccess = true;
    } catch (err: any) {
      console.error("❌ Resend error:", err);
      sendError = err.message || "Unknown error";
    }

    // Log into alert_events table
    await supabase.from("alert_events").insert({
      monitor_id: body.monitorId,
      recipient_email: toEmail,
      sent_at: new Date().toISOString(),
      success: sendSuccess,
      error_message: sendError,
    });

    if (!sendSuccess) {
      return new Response(JSON.stringify({ error: "Email send failed" }), {
        status: 500,
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("❌ Handler error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
    });
  }
});
