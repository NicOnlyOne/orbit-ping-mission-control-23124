// supabase/functions/send-alert-email/index.ts (Temporary Diagnostic Version)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }

console.log("📧 Booting send-alert-email (SIMPLIFIED DIAGNOSTIC MODE)")

serve(async (req) => {
  console.log("📞 Red phone answered! Invocation received.")
  
  try {
    const body = await req.json()
    console.log("Payload received:", body)

    // Just return a success message.
    return new Response(
      JSON.stringify({ status: "ok", message: "We received your signal." }),
      { headers: { "Content-Type": "application/json", ...corsHeaders } }
    )
  } catch (error) {
    console.error("Error inside send-alert-email:", error)
    return new Response(
      JSON.stringify({ status: "error", message: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    )
  }
})
