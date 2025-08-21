
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Types
interface TestUrlRequest {
  url: string;
  monitorId?: string;
  forceAlert?: boolean;
}

interface TestResult {
  status: string;
  errorMessage: string | null;
  responseTime: number;
  statusCode: number | null;
}

Deno.serve(async (req) => {
  try {
    const { url, monitorId, forceAlert }: TestUrlRequest = await req.json();

    if (!url) {
      return new Response(JSON.stringify({ error: "URL is required" }), {
        status: 400,
      });
    }

    // Auth headers
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAnon = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: req.headers.get("Authorization")! } },
    });
    const supabaseService = createClient(supabaseUrl, serviceRoleKey);

    // Lookup monitor row if we have a monitorId
    let monitorRow: any = null;
    let previousStatus: string | null = null;

    if (monitorId) {
      const { data: monitor, error: monitorErr } = await supabaseService
        .from("monitors")
        .select("*")
        .eq("id", monitorId)
        .single();

      if (monitorErr) {
        console.error("❌ Monitor lookup error:", monitorErr);
      } else {
        monitorRow = monitor;
        previousStatus = monitor.status;
      }
    }

    // Perform the actual test
    const start = performance.now();
    let testResult: TestResult;

    try {
      const response = await fetch(url, { method: "GET" });
      const responseTime = performance.now() - start;
      if (!response.ok) {
        testResult = {
          status: "offline",
          errorMessage: `HTTP error: ${response.status}`,
          responseTime,
          statusCode: response.status,
        };
      } else {
        testResult = {
          status: "online",
          errorMessage: null,
          responseTime,
          statusCode: response.status,
        };
      }
    } catch (err: any) {
      const responseTime = performance.now() - start;
      testResult = {
        status: "offline",
        errorMessage: err.message,
        responseTime,
        statusCode: null,
      };
    }

    // Save check to monitor_checks
    if (monitorId) {
      await supabaseService.from("monitor_checks").insert({
        monitor_id: monitorId,
        status: testResult.status,
        error_message: testResult.errorMessage,
        response_time: testResult.responseTime,
        checked_at: new Date().toISOString(),
      });

      // Update monitor row
      await supabaseService.from("monitors").update({
        status: testResult.status,
        last_checked_at: new Date().toISOString(),
        last_response_time: testResult.responseTime,
      }).eq("id", monitorId);
    }

    // Alert logic
    const isNowOffline = testResult.status === "offline";

    const cooldownMins = (monitorRow?.alert_cooldown_minutes ?? 60) as number;
    const lastAlertAt = monitorRow?.last_alert_sent_at
      ? new Date(monitorRow.last_alert_sent_at)
      : null;
    const now = new Date();
    const cooldownExpired =
      !lastAlertAt ||
      (now.getTime() - lastAlertAt.getTime()) / (1000 * 60) >= cooldownMins;

    const shouldSendEmail =
      isNowOffline &&
      (forceAlert || previousStatus !== "offline" || cooldownExpired);

    if (shouldSendEmail && monitorId && monitorRow) {
      try {
        const functionsUrl =
          `https://${new URL(supabaseUrl).hostname.replace(".supabase.co", ".functions.supabase.co")}`;

        const alertResponse = await fetch(`${functionsUrl}/send-alert-email`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${serviceRoleKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            monitorId,
            monitorName: monitorRow.name,
            monitorUrl: monitorRow.url,
            errorMessage: testResult.errorMessage,
            statusCode: testResult.statusCode || undefined,
          }),
        });

        if (!alertResponse.ok) {
          const alertError = await alertResponse.text();
          console.error("❌ Failed to send alert email:", alertError);
        } else {
          console.log("✅ Alert email triggered");

          // update last_alert_sent_at
          const { error: updateErr } = await supabaseService
            .from("monitors")
            .update({ last_alert_sent_at: now.toISOString() })
            .eq("id", monitorId);

          if (updateErr) {
            console.error("❌ Could not update last_alert_sent_at:", updateErr);
          }
        }
      } catch (err) {
        console.error("❌ Error calling send-alert-email function:", err);
      }
    }

    return new Response(JSON.stringify(testResult), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("❌ Handler error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
    });
  }
});
