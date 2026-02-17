import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/slack/api";

interface SlackNotificationRequest {
  channel: string;
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
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "Service not configured" }),
        { status: 503, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const SLACK_API_KEY = Deno.env.get("SLACK_API_KEY");
    if (!SLACK_API_KEY) {
      console.error("SLACK_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "Slack integration not connected" }),
        { status: 503, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const {
      channel,
      message,
      title = "MissionControl Alert",
      color = "#FF5C5C",
      url,
      monitorName,
      timestamp,
      username,
    }: SlackNotificationRequest = await req.json();

    if (!message || !channel) {
      return new Response(
        JSON.stringify({ error: "Message and channel are required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Build Slack Block Kit message for richer formatting
    const blocks = [
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
      blocks.push({ type: "section" as const, text: undefined as any, fields } as any);
    }

    // Also include a fallback attachment with color bar
    const payload: Record<string, unknown> = {
      channel,
      text: `${title}: ${message}`,
      blocks,
      attachments: [{ color, fallback: message, text: "" }],
      username: "MissionControl",
      icon_emoji: ":rocket:",
    };

    console.log(`Sending Slack notification to ${channel}: ${title}`);

    const slackResponse = await fetch(`${GATEWAY_URL}/chat.postMessage`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": SLACK_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const slackData = await slackResponse.json();

    if (!slackResponse.ok || !slackData.ok) {
      console.error("Slack API error:", JSON.stringify(slackData));
      return new Response(
        JSON.stringify({ error: "Failed to send Slack notification", details: slackData.error }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Slack notification sent successfully");
    return new Response(
      JSON.stringify({ success: true, message: "Slack notification sent successfully" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    console.error("Error in notify-slack function:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: "An error occurred", code: "INTERNAL_ERROR" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
