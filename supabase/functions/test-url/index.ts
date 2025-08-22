// supabase/functions/test-url/index.ts (Final, Corrected Version)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0"

// --- Helper function to check a URL ---
type ProbeResult = {
  status: 'UP' | 'DOWN'
  duration: number
  httpStatus: number | null
  error: string | null
}

async function probeUrl(url: string, timeout = 15000): Promise<ProbeResult> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  const startTime = Date.now()
  try {
    const response = await fetch(url, { signal: controller.signal, redirect: 'follow' })
    clearTimeout(timeoutId)
    const duration = Date.now() - startTime
    if (response.ok) {
      return { status: 'UP', duration, httpStatus: response.status, error: null }
    } else {
      return { status: 'DOWN', duration, httpStatus: response.status, error: `HTTP status ${response.status}` }
    }
  } catch (error) {
    clearTimeout(timeoutId)
    const duration = Date.now() - startTime
    return { status: 'DOWN', duration, httpStatus: null, error: error.message }
  }
}
// --- End of Helper function ---

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }

console.log("🚀 Booting test-url (FINAL VERSION)")

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { monitorId } = await req.json()
    if (!monitorId) {
      return new Response(JSON.stringify({ error: "monitorId is required" }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { data: monitor, error: fetchError } = await supabaseAdmin
      .from('monitors')
      .select('*')
      .eq('id', monitorId)
      .single()

    if (fetchError || !monitor) {
      throw new Error(`Monitor not found: ${fetchError?.message}`)
    }

    const result = await probeUrl(monitor.url)
    
    const updatedMonitor = {
        ...monitor,
        status: result.status,
        last_checked: new Date().toISOString(),
    }

    const { error: updateError } = await supabaseAdmin
      .from('monitors')
      .update(updatedMonitor)
      .eq('id', monitor.id)

    if (updateError) {
      console.error('Error updating monitor status:', updateError)
    }

    // --- Notification Logic ---
    const backgroundPromises = []
    if (result.status === 'DOWN') {
      console.log(`🚨 Status changed to DOWN for ${monitor.name}. Checking alert conditions.`)
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('email')
        .eq('user_id', monitor.user_id)
        .single()

      const recipientEmail = profile?.email
      if (recipientEmail) {
        console.log(`Found recipient: ${recipientEmail}. Preparing to invoke alert function.`)
        
        const simplifiedProbeResult = {
            status: result.httpStatus,
            error: result.error,
        }

        console.log("Attempting to invoke 'send-alert-email' with REAL data...")
        const invokePromise = supabaseAdmin.functions.invoke('send-alert-email', {
          body: {
            monitor: updatedMonitor,
            type: "DOWN",
            probeResult: simplifiedProbeResult,
            to: recipientEmail,
          },
        }).then(response => {
           if (response.error) {
             console.error('‼️ Invoke FAILED:', response.error)
           } else {
             console.log('✅ Invoke SUCCEEDED! Response:', response.data)
           }
           // Also handle non-2xx responses from the invoked function
           if (response.data?.error) {
             console.error('Catastrophic error in test-url:', new Error(response.data.error));
           } else if (response.error) {
             console.error('Catastrophic error in test-url:', response.error);
           }
        })
        backgroundPromises.push(invokePromise)
      } else {
        console.log('No recipient email found for this user.')
      }
    }

    if (backgroundPromises.length > 0) {
      console.log(`Waiting for ${backgroundPromises.length} background tasks to complete...`)
      await Promise.all(backgroundPromises)
      console.log('All background tasks finished.')
    }
    // --- End of Notification Logic ---

    return new Response(
      JSON.stringify({ status: result.status, duration: result.duration, httpStatus: result.httpStatus }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in test-url function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
