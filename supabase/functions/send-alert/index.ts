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

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    console.log(`Processing alert for monitor ${monitorId}: ${status}`);

    // Get monitor and user details
    const { data: monitor, error: monitorError } = await supabaseClient
      .from('monitors')
      .select(`
        *,
        profiles!inner(
          email,
          phone_number,
          slack_username,
          slack_channel,
          notification_email,
          notification_preferences,
          full_name
        )
      `)
      .eq('id', monitorId)
      .single();

    if (monitorError || !monitor) {
      console.error("Monitor not found:", monitorError);
      return new Response(
        JSON.stringify({ error: "Monitor not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const profile = monitor.profiles;
    const notifications = profile.notification_preferences || {};
    
    // Check if we should send alerts based on status and preferences
    const shouldSendDowntimeAlert = status === 'DOWN' && notifications.downtime;
    const shouldSendRecoveryAlert = status === 'UP' && notifications.recovery;
    
    if (!shouldSendDowntimeAlert && !shouldSendRecoveryAlert) {
      console.log("Alert not sent - user preferences disabled for this alert type");
      return new Response(
        JSON.stringify({ message: "Alert skipped due to user preferences" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Format alert message
    const isDown = status === 'DOWN';
    const alertMessage = isDown 
      ? `🚨 ALERT: ${monitor.name} is DOWN!\n\nURL: ${url}\nTime: ${new Date().toLocaleString()}\n${errorMessage ? `Error: ${errorMessage}` : ''}\n\nCheck your dashboard for more details.`
      : `✅ RECOVERY: ${monitor.name} is back ONLINE!\n\nURL: ${url}\nTime: ${new Date().toLocaleString()}\n${responseTime ? `Response time: ${responseTime}ms` : ''}\n\nYour site is now operational.`;

    const results = { email: null, sms: null, slack: null };

    // Send Slack notification
    if (notifications.slack) {
      try {
        const slackColor = isDown ? 'danger' : 'good';
        const slackResult = await supabaseClient.functions.invoke('notify-slack', {
          body: {
            message: alertMessage,
            title: isDown ? `🚨 Monitor Alert: ${monitor.name} is DOWN` : `✅ Monitor Recovery: ${monitor.name} is ONLINE`,
            color: slackColor,
            url: url,
            monitorName: monitor.name,
            timestamp: new Date().toISOString()
          }
        });
        
        results.slack = slackResult;
        console.log("Slack alert sent:", slackResult);
      } catch (slackError) {
        console.error("Slack alert failed:", slackError);
        results.slack = { error: slackError };
      }
    }

    // Send email notification
    if (profile.notification_email) {
      try {
        const emailResult = await supabaseClient.functions.invoke('send-email-alert', {
          body: {
            to: profile.email,
            subject: isDown ? `🚨 ${monitor.name} is DOWN` : `✅ ${monitor.name} is ONLINE`,
            message: alertMessage,
            monitorName: monitor.name,
            url: url,
            status: status,
            errorMessage: errorMessage,
            responseTime: responseTime
          }
        });
        
        results.email = emailResult;
        console.log("Email alert sent:", emailResult);
      } catch (emailError) {
        console.error("Email alert failed:", emailError);
        results.email = { error: emailError };
      }
    }

    // Send SMS notification
    if (notifications.sms && profile.phone_number) {
      try {
        const smsResult = await supabaseClient.functions.invoke('send-sms', {
          body: {
            to: profile.phone_number,
            message: alertMessage
          }
        });
        
        results.sms = smsResult;
        console.log("SMS alert sent:", smsResult);
      } catch (smsError) {
        console.error("SMS alert failed:", smsError);
        results.sms = { error: smsError };
      }
    }

    // Log the alert event
    try {
      await supabaseClient
        .from('alert_events')
        .insert({
          monitor_id: monitorId,
          user_id: monitor.user_id,
          status: isDown ? 'DOWN' : 'UP',
          channel: 'multi',
          error: errorMessage || null
        });
    } catch (logError) {
      console.error("Failed to log alert event:", logError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Alert processed",
        results: results
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error) {
    console.error("Error in send-alert function:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(error) }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);