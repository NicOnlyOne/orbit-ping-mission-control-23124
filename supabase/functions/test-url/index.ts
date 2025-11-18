import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function isValidMonitorUrl(url: string): { valid: boolean; error?: string } {
  try {
    const parsed = new URL(url);
    
    // Only allow HTTP/HTTPS
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, error: 'Only HTTP and HTTPS protocols allowed' };
    }
    
    // Block private IP ranges and localhost
    const hostname = parsed.hostname;
    const privateRanges = [
      /^localhost$/i,
      /^127\./,
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^192\.168\./,
      /^169\.254\./,
      /^::1$/,
      /^fc00:/,
      /^fe80:/
    ];
    
    if (privateRanges.some(range => range.test(hostname))) {
      return { valid: false, error: 'Private IP addresses and localhost not allowed' };
    }
    
    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { monitorId, url, forceAlert } = await req.json();
    
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get monitor details
    const { data: monitor, error: monitorError } = await supabase
      .from('monitors')
      .select('*')
      .eq('id', monitorId)
      .single();
    
    if (monitorError || !monitor) {
      throw new Error(`Monitor not found: ${monitorError?.message}`);
    }

    // Validate URL to prevent SSRF attacks
    const validation = isValidMonitorUrl(monitor.url);
    if (!validation.valid) {
      console.error(`Invalid URL rejected: ${monitor.url} - ${validation.error}`);
      throw new Error(validation.error);
    }

    console.log(`Testing URL: ${monitor.url}`);

    // Test the URL
    const start = Date.now();
    let status = "UP";
    let responseTime = 0;
    let error = null;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(monitor.url, {
        method: 'HEAD',
        signal: controller.signal,
        redirect: 'follow'
      });
      
      clearTimeout(timeoutId);
      responseTime = Date.now() - start;
      status = response.ok ? "UP" : "DOWN";
      error = response.ok ? null : `HTTP ${response.status}`;
    } catch (err) {
      responseTime = Date.now() - start;
      status = "DOWN";
      error = String(err);
    }

    const previousStatus = monitor.status;

    // Update monitor in database
    await supabase
      .from('monitors')
      .update({ 
        status,
        last_checked: new Date().toISOString(),
        response_time: responseTime,
        error_message: error
      })
      .eq('id', monitorId);

    // Log the check
    await supabase.from('monitor_logs').insert({
      monitor_id: monitorId,
      status,
      response_time: responseTime,
      error_message: error
    });

    console.log(`Status: ${status}, Response Time: ${responseTime}ms`);

    // Send alerts on status change
    const statusChanged = previousStatus !== status;
    if (statusChanged || forceAlert) {
      const { data: userData } = await supabase.auth.admin.getUserById(monitor.user_id);
      const userEmail = userData?.user?.email;

      if (userEmail) {
        if (status === "DOWN") {
          await sendEmailAlert(userEmail, monitor, "DOWN", responseTime, error);
        } else if (status === "UP" && previousStatus === "DOWN") {
          await sendEmailAlert(userEmail, monitor, "UP", responseTime, null);
        }
      }
    }

    return new Response(JSON.stringify({ 
      status,
      responseTime,
      error 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
    
  } catch (error) {
    console.error("Error:", String(error));
    return new Response(JSON.stringify({ error: String(error) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

async function sendEmailAlert(
  email: string, 
  monitor: any, 
  alertType: string,
  responseTime: number,
  errorMsg: string | null
) {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  
  if (!resendApiKey) {
    console.error("RESEND_API_KEY not configured");
    return;
  }

  const isDown = alertType === "DOWN";
  const subject = isDown 
    ? `🚨 Alert: ${monitor.name} is DOWN`
    : `✅ Recovery: ${monitor.name} is back ONLINE`;

  const htmlBody = isDown 
    ? `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #ff5c5c;">🚨 Mission Alert: Site Down</h2>
        <p><strong>${monitor.name}</strong> is currently unreachable.</p>
        <p><strong>URL:</strong> ${monitor.url}</p>
        <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
        ${errorMsg ? `<p><strong>Error:</strong> ${errorMsg}</p>` : ''}
        <p>We'll continue monitoring and notify you when the site recovers.</p>
      </div>
    `
    : `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2ecc71;">✅ Mission Control: Site Recovered</h2>
        <p><strong>${monitor.name}</strong> is back online!</p>
        <p><strong>URL:</strong> ${monitor.url}</p>
        <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
        <p><strong>Response time:</strong> ${responseTime}ms</p>
        <p>Your site is now operational. All systems go! 🚀</p>
      </div>
    `;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'MissionControl <alerts@updates.lovable.app>',
        to: [email],
        subject,
        html: htmlBody
      })
    });

    if (response.ok) {
      console.log('Email alert sent successfully');
    } else {
      const error = await response.text();
      console.error('Failed to send email:', error);
    }
  } catch (error) {
    console.error('Error sending email:', error);
  }
}
