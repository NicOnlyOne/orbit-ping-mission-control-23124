// supabase/functions/test-url/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0"

// A helper type to define what our URL check will return
type ProbeResult = {
  status: 'UP' | 'DOWN'
  responseTime: number
  httpStatus: number | null
  message: string | null
}

/**
 * Probes a URL to check its status. This function is designed to never crash.
 * It always returns a ProbeResult object.
 */
async function probeUrl(url: string, timeout = 15000): Promise<ProbeResult> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)
  const startTime = Date.now()

  try {
    const response = await fetch(url, { signal: controller.signal, redirect: 'follow' })
    clearTimeout(timeoutId)
    const responseTime = Date.now() - startTime

    if (response.ok) {
      return { status: 'UP', responseTime, httpStatus: response.status, message: response.statusText }
    } else {
      // HTTP error (e.g., 404, 500)
      return { status: 'DOWN', responseTime, httpStatus: response.status, message: `HTTP status ${response.status}` }
    }
  } catch (err) {
    clearTimeout(timeoutId)
    const responseTime = Date.now() - startTime
    // Network or other errors
    const message = err instanceof Error ? err.message : String(err)
    return { status: 'DOWN', responseTime, httpStatus: null, message }
  }
}


const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const payload = await req.json()
    const monitorId = payload.monitorId

    if (!monitorId) {
      throw new Error("Missing 'monitorId' in request body.");
    }

    // Step 1: Create a Supabase client with the service role key
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Step 2: Get the monitor's URL from the database
    const { data: monitor, error: fetchError } = await supabase
      .from("monitors")
      .select("url")
      .eq("id", monitorId)
      .single();

    if (fetchError || !monitor) {
      throw new Error(`Monitor not found for id: ${monitorId}`);
    }

    // Step 3: Probe the URL
    const result = await probeUrl(monitor.url);

    // ====================================================================
    // THE FIX IS HERE! 
    // We now use the direct result ('UP' or 'DOWN') which the DB expects.
    // ====================================================================
    const databaseStatus = result.status; 

    const updatePayload = {
      status: databaseStatus, // This will be 'UP' or 'DOWN'
      last_checked: new Date().toISOString(),
      response_time: result.responseTime,
      error_message: result.message // Save the specific error message
    };

    const { error: updateError } = await supabase
      .from("monitors")
      .update(updatePayload)
      .eq("id", monitorId);

    if (updateError) {
      // This will now clearly report the constraint violation if it happens again
      throw new Error(`Failed to update monitor ${monitorId}. DB Error: ${updateError.message}`);
    }

    // Step 4: Return a simple, safe success response.
    return new Response(JSON.stringify({ success: true, status: databaseStatus }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (err) {
    // This is the safety net. It catches any error and reports it cleanly.
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("test-url function crashed:", errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
