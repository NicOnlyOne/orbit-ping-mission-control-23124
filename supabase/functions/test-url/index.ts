// supabase/functions/test-url/index.ts (Lovable AI - Combined Logic Version)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0"

// --- Helper function to check a URL ---
type ProbeResult = {
  status: 'UP' | 'DOWN'
  responseTime: number // Renamed from duration for clarity
  httpStatus: number | null
  message: string | null // Renamed from error for clarity
}

async function probeUrl(url: string, timeout = 15000): Promise<ProbeResult> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  const startTime = Date.now()
  try {
    const response = await fetch(url, { signal: controller.signal, redirect: 'follow' })
    clearTimeout(timeoutId)
    const responseTime = Date.now() - startTime
    if (response.ok) {
      return { status: 'UP', responseTime, httpStatus: response.status, message: null }
    } else {
      return { status: 'DOWN', responseTime, httpStatus: response.status, message: `HTTP status ${response.status}` }
    }
  } catch (error) {
    clearTimeout(timeoutId)
    const responseTime = Date.now() - startTime
    // Deno specific check for net error
    if (error instanceof TypeError && error.message.includes("net")) {
        return { status: 'DOWN', responseTime, httpStatus: null, message: "Server not found or connection refused." };
    }
    return { status: 'DOWN', responseTime, httpStatus: null, message: error.message }
  }
}
// --- End of Helper function ---

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }

console.log("🚀 Booting test-url (Combined Logic Version)")

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Robust body parsing
    const bodyText = await req.text();
    if (!bodyText) {
      throw new Error("Request body is empty.");
    }
    const body = JSON.parse(bodyText);
    const { monitorId, url } = body;

    // --- SCENARIO 1: ANONYMOUS URL CHECK ---
    // If a raw URL is provided, we do a simple check and return.
    if (url) {
      console.log(`Anonymous check for URL: ${url}`);
      const result = await probeUrl(url);
      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // --- SCENARIO 2: LOGGED-IN MONITOR CHECK ---
    // If a monitorId is provided, we do the full database update and alert flow.
    if (monitorId) {
      console.log(`Authenticated check for monitorId: ${monitorId}`);
      const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      const { data: monitor, error: fetchError } = await supabaseAdmin
        .from('monitors')
        .select('*')
        .eq('id', monitorId)
        .single();

      if (fetchError || !monitor) {
        throw new Error(`Monitor not found: ${fetchError?.message}`);
      }

      const result = await probeUrl(monitor.url);

      const updatedMonitorData = {
        status: result.status,
        response_time: result.responseTime,
        last_checked: new Date().toISOString(),
        error_message: result.message,
      };

      const { error: updateError } = await supabaseAdmin
        .from('monitors')
        .update(updatedMonitorData)
        .eq('id', monitor.id);

      if (updateError) {
        console.error('Error updating monitor status:', updateError);
        // We can still return the result to the user even if DB update fails
      }

      // We don't need notification logic here for a manual test.
      // That should be handled by the scheduled 'run-all-checks' function.
      
      // Return a slimmed down result to match the anonymous one
      return new Response(
        JSON.stringify({ status: result.status, responseTime: result.responseTime, httpStatus: result.httpStatus, message: result.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If neither url nor monitorId is provided, it's a bad request.
    return new Response(JSON.stringify({ message: "Request body must contain either 'url' or 'monitorId'" }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Catastrophic error in test-url function:', error)
    return new Response(
      JSON.stringify({ message: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
