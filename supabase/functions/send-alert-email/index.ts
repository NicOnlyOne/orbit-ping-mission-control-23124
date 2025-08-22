// supabase/functions/send-alert-email/index.ts (Final Version)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { monitor, type, probeResult, to } = await req.json()

    console.log(`📧 Sending ${type} alert for ${monitor.name || monitor.url} to ${to}`)

    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) {
      console.error('❌ RESEND_API_KEY not found')
      throw new Error('Missing RESEND_API_KEY')
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Mission Control <alerts@lovable.dev>',
        to: to,
        subject: `🚨 Alert: ${monitor.name} is DOWN`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px; background-image: linear-gradient(to top, #30cfd0 0%, #330867 100%); color: white;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="font-size: 32px; margin: 0;">🚀 Mission Control Alert</h1>
              <p style="font-size: 18px; margin: 10px 0 0 0;">Houston, we have a problem!</p>
            </div>
            <div style="background: rgba(255,255,255,0.1); padding: 20px; border-radius: 10px; margin-bottom: 20px;">
              <h2 style="color: #ff6b6b; margin-top: 0;">🔴 SERVICE DOWN</h2>
              <p><strong>Service:</strong> ${monitor.name || monitor.url}</p>
              <p><strong>URL:</strong> ${monitor.url}</p>
              <p><strong>Status:</strong> DOWN 🔴</p>
              ${probeResult.error ? `<p><strong>Error:</strong> ${probeResult.error}</p>` : ''}
              ${probeResult.status ? `<p><strong>HTTP Status:</strong> ${probeResult.status}</p>` : ''}
              <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
            </div>
            <p>Please check your service immediately.</p>
            <p style="color: rgba(255,255,255,0.7); font-size: 14px; text-align: center;">
              This alert was sent from Orbit Ping Mission Control 🛰️
            </p>
          </div>
        `,
      }),
    })

    const result = await response.json()

    if (!response.ok) {
      console.error('❌ Resend API error:', result)
      throw new Error(result.message || `HTTP ${response.status}`)
    }

    console.log('✅ Email sent successfully:', result)

    return new Response(
      JSON.stringify({ success: true, result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ send-alert-email error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})```

### Step 2: Restore and Fix `test-url`

Now, we will put the original logic back into `test-url`, but with the **one crucial change**.

Replace the entire contents of `supabase/functions/test-url/index.ts` with this final, corrected code:

```typescript
// supabase/functions/test-url/index.ts (Final Version)
// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }

const TIMEOUT_MS = 15000

// Helper function to check a URL
async function checkUrl(url: string) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const startTime = Date.now()
    const response = await fetch(url, { signal: controller.signal, redirect: 'follow' })
    const duration = Date.now() - startTime
    clearTimeout(timeoutId)
    return {
      status: response.status >= 200 && response.status < 300 ? 'online' : 'offline',
      httpStatus: response.status,
      duration,
      error: null,
    }
  } catch (error: any) {
    clearTimeout(timeoutId)
    return {
      status: 'offline',
      httpStatus: null,
      duration: Date.now() - (Date.now() - TIMEOUT_MS), // approx duration
      error: error.message || 'Timeout or fetch error',
    }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { monitorId } = await req.json()
    if (!monitorId) throw new Error('Missing monitorId in request body')

    console.log(`📡 Starting test for monitor ID: ${monitorId}`)
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

    const { data: monitor, error: fetchError } = await supabaseAdmin
      .from('monitors')
      .select('*')
      .eq('id', monitorId)
      .single()

    if (fetchError || !monitor) {
      throw new Error(`Failed to fetch monitor: ${fetchError?.message || 'Not found'}`)
    }

    const result = await checkUrl(monitor.url)

    const updatedMonitor = {
      ...monitor,
      status: result.status === 'online' ? 'UP' : 'DOWN',
      last_checked: new Date().toISOString(),
    }

    const { error: updateError } = await supabaseAdmin
      .from('monitors')
      .update({ status: updatedMonitor.status, last_checked: updatedMonitor.last_checked })
      .eq('id', monitorId)

    if (updateError) {
      console.error('DB update failed:', updateError)
    }

    // --- Start of Notification Logic ---
    const backgroundPromises: Promise<any>[] = []

    if (updatedMonitor.status === 'DOWN' && monitor.status !== 'DOWN') {
      console.log(`🚨 Status changed to DOWN for ${monitor.name}. Checking alert conditions.`)
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('email')
        .eq('user_id', monitor.user_id)
        .single()

      const recipientEmail = profile?.email
      if (recipientEmail) {
        console.log(`Found recipient: ${recipientEmail}. Preparing to invoke alert function.`)
        
        // 🔽🔽🔽 THE FIX IS HERE 🔽🔽🔽
        // We create a clean, simple object to send. No complex objects.
        const simplifiedProbeResult = {
            status: result.httpStatus,
            error: result.error,
        }

        const invokePromise = supabaseAdmin.functions.invoke('send-alert-email', {
          body: {
            monitor: updatedMonitor,
            type: "DOWN",
            probeResult: simplifiedProbeResult, // We send the simple object
            to: recipientEmail,
          },
        })
        backgroundPromises.push(invokePromise)
        // 🔼🔼🔼 END OF THE FIX 🔼🔼🔼
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
