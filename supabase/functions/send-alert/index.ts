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

    // Send email alert
    const isDown = status === 'DOWN';
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
    
    if (!resendApiKey) {
      console.error("RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Service temporarily unavailable" }),
        { status: 503, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'MissionControl <alerts@updates.lovable.app>',
        to: [userEmail],
        subject,
        html: htmlBody
      })
    });

    if (!emailResponse.ok) {
      const error = await emailResponse.text();
      console.error('Failed to send email:', error);
      return new Response(
        JSON.stringify({ error: "Failed to send email alert" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Alert sent successfully");
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
