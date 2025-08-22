// PASTE THIS SAFETY-CHECK CODE INTO: supabase/functions/test-url/index.ts

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

console.log("--- REBUILD V2: Script loaded. ---");

// --- SAFETY CHECK ---
// Let's verify the secrets are loaded before we do anything else.
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("--- REBUILD V2: CRITICAL FAILURE! ---");
  console.error("--- Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY secrets. ---");
  console.error("--- Please check the function secrets in the Supabase dashboard. ---");
} else {
  console.log("--- REBUILD V2: All Supabase secrets loaded successfully. ---");
}
// --- END SAFETY CHECK ---

Deno.serve(async (req) => {
  console.log(`--- REBUILD V2: Request received: ${req.method} ---`);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // If the secrets are missing, we should not proceed.
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error("Cannot proceed: Function secrets are not configured.");
    }

    const body = await req.json();
    const monitorId = body.monitorId;
    console.log(`--- REBUILD V2: Body parsed. Monitor ID is ${monitorId}. ---`);
    
    console.log("--- REBUILD V2: Creating Supabase client. ---");
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    console.log("--- REBUILD V2: Supabase client created. ---");

    console.log(`--- REBUILD V2: Fetching monitor ${monitorId} from database. ---`);
    const { data: monitor, error } = await supabase
      .from("monitors")
      .select("*")
      .eq("id", monitorId)
      .single();

    if (error) {
      throw new Error(`Supabase error: ${error.message}`);
    }

    console.log("--- REBUILD V2: Successfully fetched monitor data! ---", monitor);

    return new Response(JSON.stringify({ message: "Successfully connected to Supabase!", data: monitor }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("--- REBUILD V2: CRITICAL ERROR IN HANDLER ---", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
