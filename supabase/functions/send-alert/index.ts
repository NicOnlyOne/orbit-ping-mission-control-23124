import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AlertRequest {
  monitorId: string;
  status: 'DOWN' | 'UP';
  url: string;
  errorMessage?: string;
  responseTime?: number;
}

async function sendSlackWebhook(
  webhookUrl: string,
  monitor: any,
  status: string,
  url: string,
  errorMessage?: string,
  responseTime?: number
) {
  if (!webhookUrl || !webhookUrl.startsWith("https://hooks.slack.com/")) {
    console.log("Invalid or missing Slack webhook URL, skipping");
    return;
  }

  const isDown = status === 'DOWN';
  const color = isDown ? "#FF5C5C" : "#2ECC71";
  const emoji = isDown ? "🚨" : "✅";
  const title = isDown
    ? `${emoji} Alert: ${monitor.name} is DOWN`
    : `${emoji} Recovery: ${monitor.name} is back ONLINE`;

  const messageParts = [
    `*${monitor.name}* is ${isDown ? 'currently unreachable' : 'back online'}!`,
    `*URL:* ${url}`,
    `*Time:* ${new Date().toLocaleString()}`,
  ];
  if (isDown && errorMessage) messageParts.push(`*Error:* ${errorMessage}`);
  if (!isDown && responseTime) messageParts.push(`*Response time:* ${responseTime}ms`);

  const payload = {
    text: title,
    blocks: [
      { type: "header", text: { type: "plain_text", text: title, emoji: true } },
      { type: "section", text: { type: "mrkdwn", text: messageParts.join("\n") } },
    ],
    attachments: [{ color, fallback: title, text: "" }],
    username: "MissionControl",
    icon_emoji: ":rocket:",
  };

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error("Slack webhook failed:", await response.text());
    } else {
      console.log("Slack notification sent via user webhook");
    }
  } catch (error) {
    console.error("Error sending Slack webhook:", error);
  }
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { monitorId, status, url, errorMessage, responseTime }: AlertRequest = await req.json();
    
    if (!monitorId || !status || !url) {
      return new Response(
        JSON.stringify({ error: "Missing required parameters" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    console.log(`Processing alert for monitor ${monitorId}: ${status}`);

    // Get monitor details
    const { data: monitor, error: monitorError } = await supabaseClient
      .from('monitors')
      .select('*')
      .eq('id', monitorId)
      .single();

    if (monitorError || !monitor) {
      console.error("Monitor lookup failed:", monitorError);
      return new Response(
        JSON.stringify({ error: "Resource not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get user profile for notification preferences
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('id', monitor.user_id)
      .single();

    // Get user email
    const { data: userData } = await supabaseClient.auth.admin.getUserById(monitor.user_id);
    const userEmail = userData?.user?.email;

    if (!userEmail) {
      console.error("User email not found for monitor:", monitor.id);
      return new Response(
        JSON.stringify({ error: "Unable to send notification" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Parse notification preferences
    let notificationPrefs = { downtime: true, recovery: true, slack: false, sms: false };
    if (profile?.notification_preferences) {
      try {
        const parsed = typeof profile.notification_preferences === 'string'
          ? JSON.parse(profile.notification_preferences)
          : profile.notification_preferences;
        notificationPrefs = { ...notificationPrefs, ...parsed };
      } catch (e) {
        console.log("Failed to parse notification preferences, using defaults");
      }
    }

    const isDown = status === 'DOWN';

    // Check if this alert type is enabled
    if (isDown && !notificationPrefs.downtime) {
      console.log("Downtime notifications disabled for this user, skipping");
      return new Response(
        JSON.stringify({ success: true, message: "Notification disabled by user preferences" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    if (!isDown && !notificationPrefs.recovery) {
      console.log("Recovery notifications disabled for this user, skipping");
      return new Response(
        JSON.stringify({ success: true, message: "Notification disabled by user preferences" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Send email alert
    const shouldSendEmail = profile?.notification_email !== false;
    if (shouldSendEmail) {
      const subject = isDown 
        ? `🚨 Alert: ${monitor.name} is DOWN`
        : `✅ Recovery: ${monitor.name} is back ONLINE`;

      const htmlBody = isDown 
        ? `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #ff5c5c;">🚨 Mission Alert: Site Down</h2>
            <p><strong>${monitor.name}</strong> is currently unreachable.</p>
            <p><strong>URL:</strong> ${url}</p>
            <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
            ${errorMessage ? `<p><strong>Error:</strong> ${errorMessage}</p>` : ''}
            <p>We'll continue monitoring and notify you when the site recovers.</p>
          </div>
        `
        : `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2ecc71;">✅ Mission Control: Site Recovered</h2>
            <p><strong>${monitor.name}</strong> is back online!</p>
            <p><strong>URL:</strong> ${url}</p>
            <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
            ${responseTime ? `<p><strong>Response time:</strong> ${responseTime}ms</p>` : ''}
            <p>Your site is now operational. All systems go! 🚀</p>
          </div>
        `;

      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      if (resendApiKey) {
        const emailResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'MissionControl <onboarding@resend.dev>',
            to: [userEmail],
            subject,
            html: htmlBody
          })
        });

        if (!emailResponse.ok) {
          console.error('Failed to send email:', await emailResponse.text());
        } else {
          console.log("Email alert sent successfully");
        }
      } else {
        console.error("RESEND_API_KEY not configured, skipping email");
      }
    }

    // Send Slack notification via user's own webhook URL
    if (notificationPrefs.slack && profile?.slack_webhook_url) {
      console.log("Sending Slack alert via user's webhook");
      await sendSlackWebhook(
        profile.slack_webhook_url,
        monitor,
        status,
        url,
        errorMessage,
        responseTime
      );
    }

    console.log("Alert processing complete");
    return new Response(
      JSON.stringify({ success: true, message: "Alert sent successfully" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error) {
    console.error("Error in send-alert function:", error);
    return new Response(
      JSON.stringify({ 
        error: "An error occurred",
        code: "INTERNAL_ERROR"
      }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
