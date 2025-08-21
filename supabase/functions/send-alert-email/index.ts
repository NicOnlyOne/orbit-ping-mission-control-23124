import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AlertEmailRequest {
  monitorId: string;
  monitorName: string;
  monitorUrl: string;
  errorMessage?: string;
  statusCode?: number;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with service role key for server operations
    const supabaseServiceRole = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { monitorId, monitorName, monitorUrl, errorMessage, statusCode }: AlertEmailRequest = await req.json();

    console.log('Sending alert email for monitor:', monitorId);

    // Get monitor details and resolve user email via Auth Admin API
    const { data: monitorRow, error: monitorError } = await supabaseServiceRole
      .from('monitors')
      .select('id, user_id, name, url')
      .eq('id', monitorId)
      .single();

    if (monitorError || !monitorRow) {
      console.error('Failed to fetch monitor:', monitorError);
      return new Response(
        JSON.stringify({ error: 'Monitor not found' }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: userData, error: userError } = await supabaseServiceRole.auth.admin.getUserById(monitorRow.user_id);
    if (userError || !userData?.user?.email) {
      console.error('Failed to fetch user or email missing:', userError);
      return new Response(
        JSON.stringify({ error: 'User email not found' }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userEmail = userData.user.email as string;
    const userName = (userData.user.user_metadata?.full_name || userData.user.user_metadata?.first_name || 'User') as string;
    const timestamp = new Date().toLocaleString('en-US', {
      timeZone: 'UTC',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short'
    });

    // Create email content
    const emailSubject = `🚨 Website Alert: ${monitorName} is Down`;
    
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
        <div style="background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #dc2626; margin: 0; font-size: 24px;">🚨 Website Alert</h1>
          </div>
          
          <p style="font-size: 16px; color: #333; margin-bottom: 20px;">Hi ${userName},</p>
          
          <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
            We detected that one of your monitored websites is currently down and needs your immediate attention.
          </p>
          
          <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <h2 style="color: #dc2626; margin: 0 0 15px 0; font-size: 18px;">Website Details</h2>
            <p style="margin: 8px 0; color: #333;"><strong>Name:</strong> ${monitorName}</p>
            <p style="margin: 8px 0; color: #333;"><strong>URL:</strong> <a href="${monitorUrl}" style="color: #2563eb;">${monitorUrl}</a></p>
            <p style="margin: 8px 0; color: #333;"><strong>Time Detected:</strong> ${timestamp}</p>
            ${statusCode ? `<p style="margin: 8px 0; color: #333;"><strong>Status Code:</strong> ${statusCode}</p>` : ''}
            ${errorMessage ? `<p style="margin: 8px 0; color: #333;"><strong>Error:</strong> ${errorMessage}</p>` : ''}
          </div>
          
          <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <h3 style="color: #f59e0b; margin: 0 0 10px 0; font-size: 16px;">Recommended Actions:</h3>
            <ul style="margin: 0; padding-left: 20px; color: #333;">
              <li style="margin-bottom: 8px;">Check your website immediately to identify the issue</li>
              <li style="margin-bottom: 8px;">Verify your server status and hosting provider</li>
              <li style="margin-bottom: 8px;">Check for any recent changes that might have caused this</li>
              <li style="margin-bottom: 8px;">Contact your technical team or hosting provider if needed</li>
            </ul>
          </div>
          
          <p style="font-size: 14px; color: #666; margin-top: 30px; text-align: center; border-top: 1px solid #e5e7eb; padding-top: 20px;">
            This is an automated alert from your website monitoring service.<br>
            We will continue monitoring and notify you when the website is back online.
          </p>
        </div>
      </div>
    `;

    const emailResponse = await resend.emails.send({
      from: "OrbitPing Alerts <onboarding@resend.dev>",
      to: [userEmail],
      subject: emailSubject,
      html: emailHtml,
    });

    console.log("Alert email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ 
      success: true, 
      emailId: emailResponse.data?.id,
      sentTo: userEmail 
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error("Error in send-alert-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);