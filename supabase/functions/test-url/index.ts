// supabase/functions/test-url/index.ts (Temporary Diagnostic Version)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }

console.log("🚀 Booting test-url (SIMPLIFIED DIAGNOSTIC MODE)")

serve(async (_req) => {
  // This function now does only ONE thing: tries to invoke the other function.
  try {
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

    console.log("Attempting to invoke 'send-alert-email' with a simple message...")

    const { data, error } = await supabaseAdmin.functions.invoke('send-alert-email', {
      body: { message: "Red phone is ringing. Please pick up." },
    })

    if (error) {
      console.error("‼️ Invoke FAILED:", error)
      throw new Error(`Failed to invoke function: ${error.message}`)
    }

    console.log("✅ Invoke SUCCEEDED! Response from send-alert-email:", data)

    return new Response(
      JSON.stringify({ success: true, message: "Successfully invoked send-alert-email" }),
      { headers: { "Content-Type": "application/json", ...corsHeaders } }
    )

  } catch (err: any) {
    console.error("❌ Catastrophic error in test-url:", err)
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    )
  }
})
