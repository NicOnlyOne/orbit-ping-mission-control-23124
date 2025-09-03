import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendSMSRequest {
  to: string;
  message: string;
}

interface TwilioResponse {
  sid: string;
  status: string;
  error_code?: string;
  error_message?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, message }: SendSMSRequest = await req.json();
    
    if (!to || !message) {
      return new Response(
        JSON.stringify({ error: "Phone number and message are required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get Twilio credentials from environment
    const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioPhoneNumber = Deno.env.get("TWILIO_PHONE_NUMBER");
    
    if (!twilioSid || !twilioToken || !twilioPhoneNumber) {
      console.error("Missing Twilio credentials or phone number");
      return new Response(
        JSON.stringify({ error: "SMS service not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    // Get authenticated user
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    
    if (authError || !user) {
      console.error("Authentication error:", authError);
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Sending SMS to ${to} from user ${user.id}`);

    // Create SMS log entry with pending status
    const { data: smsLog, error: logError } = await supabaseClient
      .from('sms_logs')
      .insert({
        user_id: user.id,
        to_number: to,
        message: message,
        status: 'pending'
      })
      .select()
      .single();

    if (logError) {
      console.error("Error creating SMS log:", logError);
      return new Response(
        JSON.stringify({ error: "Failed to create SMS log" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    try {
      // Send SMS via Twilio API
      const twilioResponse = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
        {
          method: "POST",
          headers: {
            "Authorization": `Basic ${btoa(`${twilioSid}:${twilioToken}`)}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            To: to,
            From: twilioPhoneNumber,
            Body: message,
          }),
        }
      );

      const twilioData: TwilioResponse = await twilioResponse.json();
      
      if (twilioResponse.ok) {
        console.log("SMS sent successfully:", twilioData);
        
        // Update SMS log with success
        await supabaseClient
          .from('sms_logs')
          .update({
            status: 'sent',
            twilio_sid: twilioData.sid
          })
          .eq('id', smsLog.id);

        return new Response(
          JSON.stringify({ 
            success: true, 
            sid: twilioData.sid,
            status: twilioData.status,
            message: "SMS sent successfully" 
          }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      } else {
        console.error("Twilio API error:", twilioData);
        
        // Update SMS log with failure
        await supabaseClient
          .from('sms_logs')
          .update({
            status: 'failed',
            error_message: twilioData.error_message || 'Unknown Twilio error'
          })
          .eq('id', smsLog.id);

        // Check for trial account specific errors
        const isTrial = twilioData.error_message?.includes('trial') || 
                       twilioData.error_message?.includes('verified') ||
                       twilioData.error_code === '21608';

        const errorMessage = isTrial 
          ? "Twilio trial account: Can only send SMS to verified phone numbers. Please verify this number in your Twilio console or upgrade your account."
          : `Failed to send SMS: ${twilioData.error_message || 'Unknown Twilio error'}`;

        return new Response(
          JSON.stringify({ 
            error: errorMessage,
            details: twilioData.error_message,
            error_code: twilioData.error_code,
            is_trial_limitation: isTrial
          }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    } catch (twilioError) {
      console.error("Error calling Twilio API:", twilioError);
      
      // Update SMS log with failure
      await supabaseClient
        .from('sms_logs')
        .update({
          status: 'failed',
          error_message: String(twilioError)
        })
        .eq('id', smsLog.id);

      return new Response(
        JSON.stringify({ error: "Failed to send SMS", details: String(twilioError) }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
  } catch (error) {
    console.error("Error in send-sms function:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(error) }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);