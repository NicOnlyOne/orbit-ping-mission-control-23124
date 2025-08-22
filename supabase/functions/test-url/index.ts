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
      return { status: 'UP', responseTime, httpStatus: response.status, message: null }
    } else {
      return { status: 'DOWN', responseTime, httpStatus: response.status, message: `HTTP status ${response.status}` }
    }
  } catch (error) {
    clearTimeout(timeoutId)
    const responseTime = Date.now() - startTime
    // Make error message safe and readable
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { status: 'DOWN', responseTime, httpStatus: null, message: errorMessage }
  }
}

// Load environment variables
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }

// Main server function
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { monitorId, url: initialUrl } = body;

    // This function handles both anonymous checks and logged-in checks.
    // We need a URL to test, regardless.
    if (!monitorId && !initialUrl) {
      return new Response(JSON.stringify({ error: "Request must include 'monitorId' or 'url'." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    let targetUrl = initialUrl;

    // Step 1: If we have a monitorId but no URL, find the URL in the database.
    // This happens during automated checks.
    if (monitorId && !targetUrl) {
      const { data: monitor, error: fetchError } = await supabase
        .from("monitors")
        .select("url")
        .eq("id", monitorId)
        .single();

      if (fetchError || !monitor) {
        throw new Error(`Monitor ${monitorId} not found.`);
      }
      targetUrl = monitor.url;
    }

    // Step 2: Probe the target URL.
    const result = await probeUrl(targetUrl);

    // If it's just an anonymous check, return the result now.
    if (!monitorId) {
       return new Response(JSON.stringify({ status: result.status, responseTime: result.responseTime }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // Step 3: For logged-in users, update the monitor in the database.
    // Translate status for the database trigger ('UP' -> 'online')
    const databaseStatus = result.status === 'UP' ? 'online' : 'offline';
    const updatePayload = {
      status: databaseStatus,
      response_time: result.responseTime,
      last_checked: new Date().toISOString(),
      error_message: result.message // Save the specific error message
    };

    const { error: updateError } = await supabase
      .from("monitors")
      .update(updatePayload)
      .eq("id", monitorId);

    if (updateError) {
      // If the update fails, throw a clear error instead of crashing.
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
