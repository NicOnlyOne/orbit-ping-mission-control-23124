import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VALID_PLANS = ["free", "pro-25", "pro-50", "enterprise-100", "enterprise-250"];

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // Verify caller identity
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user: callerUser }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !callerUser) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    const adminUserId = callerUser.id;

    // Verify admin role
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: roleData } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', adminUserId)
      .eq('role', 'admin')
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // Parse and validate request body
    const { userId, plan } = await req.json();

    if (!userId || !plan) {
      return new Response(JSON.stringify({ error: 'Missing userId or plan' }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    if (!VALID_PLANS.includes(plan)) {
      return new Response(JSON.stringify({ error: 'Invalid plan' }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // Update the user's plan
    const { error: updateError } = await adminClient
      .from('profiles')
      .update({ subscription_plan: plan })
      .eq('id', userId);

    if (updateError) {
      console.error("Error updating plan:", updateError);
      return new Response(JSON.stringify({ error: 'Failed to update plan' }), {
        status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  } catch (error) {
    console.error("Error in admin-update-plan:", error);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
};

serve(handler);
