// deno-lint-ignore-file no-explicit-any
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
        from: 'onboarding@resend.dev',
        to: [to],
        subject: `🚨 Mission Alert: ${monitor.name || monitor.url} is DOWN`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
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
})
