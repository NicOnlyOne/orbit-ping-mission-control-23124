// PASTE THIS SIMPLE TEST CODE INTO: supabase/functions/test-url/index.ts

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

console.log("--- TEST V1: Function script loaded, server starting. ---");

Deno.serve(async (req) => {
  console.log(`--- TEST V1: Request received: ${req.method} ---`);

  // Handle the browser's pre-flight check
  if (req.method === "OPTIONS") {
    console.log("--- TEST V1: Responding to OPTIONS request. ---");
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // We still need to read the body that the browser sends
    const body = await req.json();
    console.log("--- TEST V1: Request body parsed successfully. ---", body);

    const responsePayload = {
      message: "Test function executed successfully!",
      monitorId_received: body.monitorId,
    };

    console.log("--- TEST V1: Sending success response. ---");
    return new Response(JSON.stringify(responsePayload), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("--- TEST V1: CRITICAL ERROR IN HANDLER ---", error.message);
    return new Response(JSON.stringify({ error: "The test function failed." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
