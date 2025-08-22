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
          return new Response(JSON.stringify({ error: `Monitor with ID ${monitorId} not found.` }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 404,
          });
        }
        monitorUrl = monitor.url;
      }
      
      const result = await probeUrl(monitorUrl);
      const databaseStatus = result.status === 'UP' ? 'online' : 'offline';

      const updatedMonitorData = {
        status: databaseStatus,
        response_time: result.responseTime,
        last_checked: new Date().toISOString()
      };

      const { data: finalData, error: updateError } = await supabase
        .from("monitors")
        .update(updatedMonitorData)
        .eq("id", monitorId)
        .select()
        .single();
      
      if (updateError) {
        throw updateError;
      }

      // <<< LOVABLE AI FIX: Added safety check.
      // This prevents the 500 error if the update fails to find the monitor.
      if (!finalData) {
        return new Response(JSON.stringify({ error: `Failed to update monitor ${monitorId}. It may not exist.` }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 404,
          });
      }
      
      return new Response(JSON.stringify(finalData), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    return new Response(JSON.stringify({ error: "Invalid request. Provide 'url' or 'monitorId'." }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });

  } catch (err) {
    console.error("Critical error in test-url function:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
