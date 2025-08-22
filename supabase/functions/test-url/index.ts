// supabase/functions/test-url/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0"

type ProbeResult = {
  status: 'UP' | 'DOWN'
  responseTime: number
  httpStatus: number | null
  message: string | null
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
    if (error instanceof TypeError && error.message.includes("net")) {
        return { status: 'DOWN', responseTime, httpStatus: null, message: "Server not found or connection refused." };
    }
    return { status: 'DOWN', responseTime, httpStatus: null, message: error.message }
  }
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json();
    const { monitorId, url } = body;

    // SCENARIO 1: Anonymous URL Check (no monitorId)
    if (url && !monitorId) {
      const result = await probeUrl(url);
      // For anonymous checks, we can still return UP/DOWN
      return new Response(JSON.stringify({ status: result.status }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // SCENARIO 2: Logged-in Monitor Test (monitorId is present)
    if (monitorId) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      
      let monitorUrl = url;

      if (!monitorUrl) {
        const { data: monitor, error: fetchError } = await supabase
          .from("monitors")
          .select("url")
          .eq("id", monitorId)
          .single();

        if (fetchError || !monitor) {
          throw new Error(`Monitor with ID ${monitorId} not found.`);
        }
        monitorUrl = monitor.url;
      }
      
      const result = await probeUrl(monitorUrl);

      // <<< LOVABLE AI FIX: Translate status to trigger the email function
      // The database trigger expects 'online' or 'offline', not 'UP' or 'DOWN'.
      const databaseStatus = result.status === 'UP' ? 'online' : 'offline';

      const updatedMonitorData = {
        status: databaseStatus, // Use the correct status word
        response_time: result.responseTime,
        last_checked: new Date().toISOString()
      };

      const { data: updatedData, error: updateError } = await supabase
        .from("monitors")
        .update(updatedMonitorData)
        .eq("id", monitorId)
        .select()
        .single();
      
      if (updateError) {
        throw updateError;
      }
      
      // Return the original UP/DOWN status to the frontend for consistency
      return new Response(JSON.stringify({ ...updatedData, status: result.status }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    throw new Error("Invalid request. Provide 'url' for anonymous check or 'monitorId' for authenticated check.");

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
