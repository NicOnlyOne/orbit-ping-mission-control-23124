// PASTE THIS REBUILD CODE INTO: supabase/functions/test-url/index.ts

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

console.log("--- REBUILD V1: Script loaded, server starting. ---");

// IMPORTANT: These secrets must be set in your Supabase project dashboard
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  console.log(`--- REBUILD V1: Request received: ${req.method} ---`);

  if (req.method === "OPTIONS") {
    console.log("--- REBUILD V1: Responding to OPTIONS request. ---");
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const monitorId = body.monitorId;
    console.log(`--- REBUILD V1: Body parsed. Monitor ID is ${monitorId}. ---`);

    if (!monitorId) {
      throw new Error("Monitor ID is missing from the request.");
    }
    
    console.log("--- REBUILD V1: Creating Supabase client. ---");
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    console.log("--- REBUILD V1: Supabase client created. ---");

    console.log(`--- REBUILD V1: Fetching monitor ${monitorId} from database. ---`);
    const { data: monitor, error } = await supabase
      .from("monitors")
      .select("*")
      .eq("id", monitorId)
      .single();

    if (error) {
      console.error("--- REBUILD V1: Supabase fetch error! ---", error.message);
      throw new Error(`Supabase error: ${error.message}`);
    }

    console.log("--- REBUILD V1: Successfully fetched monitor data! ---", monitor);

    return new Response(JSON.stringify({ message: "Successfully connected to Supabase and fetched data!", data: monitor }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("--- REBUILD V1: CRITICAL ERROR IN HANDLER ---", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
