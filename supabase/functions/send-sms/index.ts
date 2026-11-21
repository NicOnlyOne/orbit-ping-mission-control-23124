import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...corsHeaders } });

const MAX_PER_HOUR = 10;

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const authClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userError } = await authClient.auth.getUser();
    if (userError || !user) return json({ error: "Unauthorized" }, 401);

    const { to, message } = await req.json();
    if (typeof to !== "string" || typeof message !== "string" || !to || !message) {
      return json({ error: "Phone number and message are required" }, 400);
    }
    if (!/^\+[1-9]\d{6,14}$/.test(to)) return json({ error: "Invalid phone number format" }, 400);
    if (message.length > 320) return json({ error: "Message too long" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Per-user rate limit
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await admin
      .from("sms_logs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", since);
    if ((count ?? 0) >= MAX_PER_HOUR) return json({ error: "Too many SMS requests, try again later" }, 429);

    const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioPhoneNumber = Deno.env.get("TWILIO_PHONE_NUMBER");
    if (!twilioSid || !twilioToken || !twilioPhoneNumber) {
      console.error("Twilio credentials not configured");
      return json({ error: "Service temporarily unavailable" }, 503);
    }

    console.log(`Sending SMS for user ${user.id}`);

    const twilioResponse = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          "Authorization": `Basic ${btoa(`${twilioSid}:${twilioToken}`)}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: to, From: twilioPhoneNumber, Body: message }),
      }
    );
    const twilioData = await twilioResponse.json();

    await admin.from("sms_logs").insert({
      user_id: user.id,
      to_number: to,
      message,
      status: twilioResponse.ok ? "sent" : "failed",
      twilio_sid: twilioData?.sid ?? null,
      error_message: twilioResponse.ok ? null : String(twilioData?.message ?? "error").slice(0, 200),
    });

    if (twilioResponse.ok) {
      console.log("SMS sent successfully:", twilioData.sid);
      return json({ success: true, message: "SMS sent successfully", sid: twilioData.sid }, 200);
    }
    console.error("Twilio API error code:", twilioData?.code);
    return json({ error: "Failed to send SMS" }, 400);
  } catch (error) {
    console.error("Error in send-sms function:", error);
    return json({ error: "An error occurred", code: "INTERNAL_ERROR" }, 500);
  }
};

serve(handler);
