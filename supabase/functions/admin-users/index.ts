import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify the caller is an admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    const userId = claimsData.claims.sub;

    // Check admin role using service role client
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: roleData } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // Fetch all profiles
    const { data: profiles, error: profilesError } = await adminClient
      .from('profiles')
      .select('id, full_name, email, subscription_plan, created_at, avatar_url')
      .order('created_at', { ascending: false });

    if (profilesError) {
      console.error("Error fetching profiles:", profilesError);
      return new Response(JSON.stringify({ error: 'Failed to fetch users' }), {
        status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // Fetch monitor counts per user
    const { data: monitors } = await adminClient
      .from('monitors')
      .select('user_id, enabled');

    // Aggregate monitor counts
    const monitorCounts: Record<string, { total: number; enabled: number }> = {};
    monitors?.forEach((m) => {
      if (!monitorCounts[m.user_id]) {
        monitorCounts[m.user_id] = { total: 0, enabled: 0 };
      }
      monitorCounts[m.user_id].total++;
      if (m.enabled) monitorCounts[m.user_id].enabled++;
    });

    // Decrypt emails using auth admin
    const usersWithDetails = await Promise.all(
      (profiles || []).map(async (profile) => {
        const { data: authUser } = await adminClient.auth.admin.getUserById(profile.id);
        return {
          id: profile.id,
          full_name: profile.full_name,
          email: authUser?.user?.email || 'Unknown',
          subscription_plan: profile.subscription_plan || 'free',
          created_at: profile.created_at,
          avatar_url: profile.avatar_url,
          monitors_total: monitorCounts[profile.id]?.total || 0,
          monitors_enabled: monitorCounts[profile.id]?.enabled || 0,
        };
      })
    );

    return new Response(JSON.stringify({ users: usersWithDetails }), {
      status: 200, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  } catch (error) {
    console.error("Error in admin-users function:", error);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
};

serve(handler);
