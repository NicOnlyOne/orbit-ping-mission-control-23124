// PASTE THIS PROBE CODE INTO: supabase/functions/test-url/index.ts

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

console.log("--- REBUILD V3: Script loaded. ---");

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TIMEOUT_MS = 15_000; // 15 second timeout for the probe

Deno.serve(async (req) => {
  console.log(`--- REBUILD V3: Request received: ${req.method} ---`);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Function secrets are not configured.");
    }

    const body = await req.json();
    const monitorId = body.monitorId;
    console.log(`--- REBUILD V3: Body parsed. Monitor ID is ${monitorId}. ---`);
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    console.log(`--- REBUILD V3: Fetching monitor ${monitorId} from database. ---`);
    
    const { data: monitor, error: dbError } = await supabase
      .from("monitors")
      .select("id, name, url") // We only need these for the probe
      .eq("id", monitorId)
      .single();

    if (dbError) throw new Error(`Supabase error: ${dbError.message}`);
    console.log(`--- REBUILD V3: Successfully fetched monitor: ${monitor.name} ---`);

    // --- NEW: URL PROBE LOGIC ---
    let finalStatus: "UP" | "DOWN" = "DOWN";
    let responseTime: number | null = null;
    let errorMessage: string | null = null;
    
    try {
      console.log(`--- REBUILD V3: Probing URL: ${monitor.url} ---`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
      
      const startTime = Date.now();
      const response = await fetch(monitor.url, { signal: controller.signal });
      const endTime = Date.now();
      
      clearTimeout(timeoutId);
      responseTime = endTime - startTime;
      
      if (response.ok) {
        finalStatus = "UP";
        console.log(`--- REBUILD V3: Probe successful! Status: UP, Time: ${responseTime}ms ---`);
      } else {
        finalStatus = "DOWN";
        errorMessage = `HTTP Error: Status ${response.status}`;
        console.log(`--- REBUILD V3: Probe failed. Status: DOWN, Reason: ${errorMessage} ---`);
      }
    } catch (fetchError) {
      finalStatus = "DOWN";
      errorMessage = fetchError.message;
      console.error(`--- REBUILD V3: Probe failed with exception. ---`, fetchError.message);
    }
    // --- END OF NEW LOGIC ---

    // For now, we just return the result. We don't update the database or send alerts yet.
    return new Response(JSON.stringify({ 
        message: "Probe complete!", 
        status: finalStatus,
        responseTime: responseTime,
        error: errorMessage
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("--- REBUILD V3: CRITICAL ERROR IN HANDLER ---", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
