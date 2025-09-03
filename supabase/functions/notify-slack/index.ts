import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SlackNotificationRequest {
  message: string;
  title?: string;
  color?: 'good' | 'warning' | 'danger';
  url?: string;
  monitorName?: string;
  timestamp?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, title = "MissionControl Alert", color = "warning", url, monitorName, timestamp }: SlackNotificationRequest = await req.json();
    
    if (!message) {
      return new Response(
        JSON.stringify({ error: "Message is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get Slack webhook URL from environment
    const slackWebhookUrl = Deno.env.get("SLACK_WEBHOOK_URL");
    
    if (!slackWebhookUrl) {
      console.error("Missing Slack webhook URL");
      return new Response(
        JSON.stringify({ error: "Slack webhook not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get authenticated user (optional for this function)
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization") || "" },
        },
      }
    );

    let user = null;
    try {
      const { data: { user: authUser } } = await supabaseClient.auth.getUser();
      user = authUser;
    } catch (authError) {
      console.log("No authenticated user, sending anonymous notification");
    }

    // Prepare Slack message payload
    const slackPayload = {
      text: title,
      attachments: [
        {
          color: color,
          title: monitorName ? `Monitor: ${monitorName}` : "System Alert",
          text: message,
          fields: [
            ...(url ? [{ title: "URL", value: url, short: true }] : []),
            ...(timestamp ? [{ title: "Time", value: new Date(timestamp).toLocaleString(), short: true }] : []),
            ...(user ? [{ title: "User", value: user.email || "Unknown", short: true }] : [])
          ],
          footer: "MissionControl Monitoring",
          ts: Math.floor(Date.now() / 1000)
        }
      ]
    };

    console.log(`Sending Slack notification: ${title}`);
    console.log('Slack payload:', JSON.stringify(slackPayload, null, 2));

    // Send to Slack
    const slackResponse = await fetch(slackWebhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(slackPayload),
    });

    if (slackResponse.ok) {
      console.log("Slack notification sent successfully");
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Slack notification sent successfully" 
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    } else {
      const slackError = await slackResponse.text();
      console.error("Slack API error:", slackError);
      return new Response(
        JSON.stringify({ 
          error: "Failed to send Slack notification",
          details: slackError
        }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
  } catch (error) {
    console.error("Error in notify-slack function:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(error) }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);