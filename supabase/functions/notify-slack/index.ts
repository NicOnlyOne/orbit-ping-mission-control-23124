import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SlackNotificationRequest {
  webhookUrl: string;
  message: string;
  title?: string;
  color?: string;
  url?: string;
  monitorName?: string;
  timestamp?: string;
  username?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      webhookUrl,
      message,
      title = "MissionControl Alert",
      color = "#FF5C5C",
      url,
      monitorName,
      timestamp,
      username,
    }: SlackNotificationRequest = await req.json();

    if (!webhookUrl || !message) {
      return new Response(
        JSON.stringify({ error: "webhookUrl and message are required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Validate webhook URL format
    if (!webhookUrl.startsWith("https://hooks.slack.com/")) {
      return new Response(
        JSON.stringify({ error: "Invalid Slack webhook URL" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Build Slack Block Kit message
    const blocks: any[] = [
      {
        type: "header",
        text: { type: "plain_text", text: title, emoji: true },
      },
      {
        type: "section",
        text: { type: "mrkdwn", text: message },
      },
    ];

    if (monitorName || url || timestamp) {
      const fields: { type: string; text: string }[] = [];
      if (monitorName) fields.push({ type: "mrkdwn", text: `*Monitor:*\n${monitorName}` });
      if (url) fields.push({ type: "mrkdwn", text: `*URL:*\n${url}` });
      if (timestamp) fields.push({ type: "mrkdwn", text: `*Time:*\n${new Date(timestamp).toLocaleString()}` });
      if (username) fields.push({ type: "mrkdwn", text: `*User:*\n${username}` });
      blocks.push({ type: "section", fields });
    }

    // Slack Incoming Webhooks payload
    const payload = {
      text: `${title}: ${message}`,
      blocks,
      attachments: [{ color, fallback: message, text: "" }],
      username: "MissionControl",
      icon_emoji: ":rocket:",
    };

    console.log(`Sending Slack notification via user webhook`);

    const slackResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!slackResponse.ok) {
      const errorText = await slackResponse.text();
      console.error("Slack webhook error:", errorText);
      return new Response(
        JSON.stringify({ error: "Failed to send Slack notification", details: errorText }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Slack notification sent successfully via webhook");
    return new Response(
      JSON.stringify({ success: true, message: "Slack notification sent successfully" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    console.error("Error in notify-slack function:", error);
    return new Response(
      JSON.stringify({ error: "An error occurred", code: "INTERNAL_ERROR" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
