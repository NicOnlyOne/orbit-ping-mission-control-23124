// PASTE THIS CODE INTO THE NEW FILE: supabase/functions/send-alert/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0"
import { Resend } from "npm:resend@3.4.0";

type Monitor = {
  name: string;
  url: string;
  profiles: {
    email: string;
  } | null;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { monitorId } = await req.json();
    if (!monitorId) throw new Error("Missing monitorId in request body");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const resend = new Resend(Deno.env.get("RESEND_API_KEY")!);

    // Fetch the monitor details and the user's email via a relationship
    const { data: monitor, error } = await supabase
      .from("monitors")
      .select(`name, url, profiles ( email )`)
      .eq("id", monitorId)
      .single();

    if (error || !monitor) throw new Error(`Failed to fetch monitor: ${error?.message}`);
    
    const recipientEmail = monitor.profiles?.email;
    if (!recipientEmail) throw new Error(`No email found for monitor owner: ${monitorId}`);

    // Send the email
    await resend.emails.send({
      from: "Mission Control <alerts@lovable.app>",
      to: recipientEmail,
      subject: `🚨 Alert: Your site "${monitor.name}" is DOWN`,
      html: `<p>Heads up, Commander!</p><p>Our sensors indicate that your monitored site <strong>${monitor.name}</strong> (${monitor.url}) is currently unresponsive.</p><p>We will continue to monitor the situation and let you know when it's back online.</p><p>- OrbitPing Mission Control</p>`,
    });

    return new Response(JSON.stringify({ success: true, message: `Alert sent to ${recipientEmail}` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (err) {
    return new Response(String(err?.message ?? err), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
