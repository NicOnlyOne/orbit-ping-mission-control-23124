import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple in-memory rate limiter by IP (resets on cold start)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 5; // 5 anonymous requests per minute per IP

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

// Block requests to private/internal IPs (SSRF protection)
function isPrivateUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    const hostname = parsed.hostname.toLowerCase();
    // Block internal/private hostnames
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0" ||
      hostname === "::1" ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".internal") ||
      hostname === "metadata.google.internal" ||
      hostname === "169.254.169.254" ||
      /^10\./.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
      /^192\.168\./.test(hostname)
    ) {
      return true;
    }
    // Block non-http(s) protocols
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return true;
    }
    return false;
  } catch {
    return true;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { monitorId, url, forceAlert } = await req.json();

    // --- AUTHENTICATED PATH: monitor operations require a valid user ---
    if (monitorId) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      const supabaseAuth = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );

      const token = authHeader.replace("Bearer ", "");
      const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
      if (claimsError || !claimsData?.claims) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      const userId = claimsData.claims.sub;

      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      // Get monitor and verify ownership
      const { data: monitor, error: monitorError } = await supabase
        .from('monitors')
        .select('*')
        .eq('id', monitorId)
        .eq('user_id', userId)
        .single();

      if (monitorError || !monitor) {
        return new Response(
          JSON.stringify({ error: "Resource not found" }),
          { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      return await handleMonitorTest(supabase, monitor, forceAlert);
    }

    // --- ANONYMOUS PATH: simple URL check with rate limiting ---
    if (url) {
      const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
                        req.headers.get("cf-connecting-ip") || "unknown";

      if (isRateLimited(clientIp)) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      let cleanUrl = url.trim();
      if (!cleanUrl.startsWith("http://") && !cleanUrl.startsWith("https://")) {
        cleanUrl = "https://" + cleanUrl;
      }

      if (isPrivateUrl(cleanUrl)) {
        return new Response(
          JSON.stringify({ error: "URL not allowed" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      return await handleAnonymousTest(cleanUrl);
    }

    return new Response(
      JSON.stringify({ error: "Missing required parameters" }),
      { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error) {
    console.error("Error testing URL:", error);
    return new Response(JSON.stringify({
      error: "An error occurred while testing the URL",
      code: "INTERNAL_ERROR"
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

// Handle authenticated monitor test with DB updates and alerts
async function handleMonitorTest(supabase: any, monitor: any, forceAlert: boolean) {
  const { status, responseTime, error } = await testUrl(monitor.url);
  const previousStatus = monitor.status;

  await supabase
    .from('monitors')
    .update({
      status,
      last_checked: new Date().toISOString(),
      response_time: responseTime,
      error_message: error
    })
    .eq('id', monitor.id);

  await supabase.from('monitor_logs').insert({
    monitor_id: monitor.id,
    status,
    response_time: responseTime,
    error_message: error
  });

  console.log(`Monitor ${monitor.id}: ${status}, ${responseTime}ms`);

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

  return new Response(JSON.stringify({ status, responseTime, error }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: 200,
  });
}

// Handle anonymous URL test (no DB writes)
async function handleAnonymousTest(url: string) {
  const { status, responseTime, error } = await testUrl(url);

  return new Response(JSON.stringify({ status, responseTime, error }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: 200,
  });
}

// Core URL testing logic
async function testUrl(url: string): Promise<{ status: string; responseTime: number; error: string | null }> {
  const start = Date.now();
  let status = "UP";
  let responseTime = 0;
  let error: string | null = null;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(url, {
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
    const errStr = String(err);
    if (errStr.includes("invalid peer certificate") || errStr.includes("certificate") || errStr.includes("SSL") || errStr.includes("tls")) {
      error = "🔒 SSL Certificate Error: The site's SSL certificate is invalid or expired.";
    } else if (errStr.includes("abort")) {
      error = "⏱️ Connection timed out after 30 seconds.";
    } else {
      error = "Connection failed";
    }
  }

  return { status, responseTime, error };
}

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
  const isSSL = errorMsg && (errorMsg.toLowerCase().includes("ssl") || errorMsg.toLowerCase().includes("certificate") || errorMsg.toLowerCase().includes("tls"));

  const subject = isDown
    ? isSSL
      ? `🔒 SSL Alert: ${monitor.name} has a certificate issue`
      : `🚨 Alert: ${monitor.name} is DOWN`
    : `✅ Recovery: ${monitor.name} is back ONLINE`;

  const downHeading = isSSL ? `🔒 SSL Certificate Issue Detected` : `🚨 Mission Alert: Site Down`;
  const downMessage = isSSL
    ? `<strong>${monitor.name}</strong> has an SSL/TLS certificate problem.`
    : `<strong>${monitor.name}</strong> is currently unreachable.`;

  const htmlBody = isDown
    ? `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: ${isSSL ? '#e67e22' : '#ff5c5c'};">${downHeading}</h2>
        <p>${downMessage}</p>
        <p><strong>URL:</strong> ${monitor.url}</p>
        <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
        ${errorMsg ? `<p><strong>Error:</strong> ${errorMsg}</p>` : ''}
        <p>We'll continue monitoring and notify you when the site recovers.</p>
      </div>`
    : `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2ecc71;">✅ Mission Control: Site Recovered</h2>
        <p><strong>${monitor.name}</strong> is back online!</p>
        <p><strong>URL:</strong> ${monitor.url}</p>
        <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
        <p><strong>Response time:</strong> ${responseTime}ms</p>
        <p>Your site is now operational. All systems go! 🚀</p>
      </div>`;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'MissionControl <onboarding@resend.dev>',
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
