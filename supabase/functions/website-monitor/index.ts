import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

// --- Config ---
const COOLDOWN_MINUTES = 60;
const TIMEOUT_MS = 15_000;

// --- Types ---
type Monitor = {
  id: string;
  url: string;
  status: "UP" | "DOWN" | null;
  last_alert_sent: string | null;
};

// --- Main Function ---
Deno.serve(async () => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Fetch all enabled monitors
    const { data: monitors, error: fetchError } = await supabase
      .from("monitors")
      .select("id, url, status, last_alert_sent")
      .eq("enabled", true);

    if (fetchError) throw fetchError;

    // 2. Check each monitor concurrently
    const checkPromises = monitors.map(async (monitor) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

      let probeResult: { newStatus: "UP" | "DOWN"; message: string };

      try {
        const response = await fetch(monitor.url, { signal: controller.signal });
        probeResult = response.ok
          ? { newStatus: "UP", message: response.statusText }
          : { newStatus: "DOWN", message: `HTTP status ${response.status}` };
      } catch (err) {
        probeResult = { newStatus: "DOWN", message: err.message };
      } finally {
        clearTimeout(timeoutId);
      }

      const now = new Date();

      // 3. Decide if an alert needs to be sent
      let shouldSendAlert = false;
      if (probeResult.newStatus === "DOWN") {
        if (monitor.status !== "DOWN") {
          shouldSendAlert = true; // Status just changed to DOWN
        } else {
          // Status is still DOWN, check cooldown
          if (monitor.last_alert_sent) {
            const lastAlertTime = new Date(monitor.last_alert_sent).getTime();
            const cooldownPeriod = COOLDOWN_MINUTES * 60 * 1000;
            if (now.getTime() - lastAlertTime > cooldownPeriod) {
              shouldSendAlert = true; // Cooldown has passed
            }
          } else {
            shouldSendAlert = true; // No previous alert, send one
          }
        }
      }

      // 4. Update the database record
      const updatePayload: any = {
        status: probeResult.newStatus,
        last_checked: now.toISOString(),
        error_message: probeResult.newStatus === "DOWN" ? probeResult.message : null,
      };

      if (shouldSendAlert) {
        updatePayload.last_alert_sent = now.toISOString();
        
        // 5. Tell our dedicated "Postman" to send the email
        console.log(`Invoking send-alert for monitor: ${monitor.id}`);
        // This is a "fire-and-forget" call, we don't wait for it to finish
        supabase.functions.invoke('send-alert', { body: { monitorId: monitor.id } });
      }

      await supabase.from("monitors").update(updatePayload).eq("id", monitor.id);
    });

    await Promise.all(checkPromises);

    return new Response("ok");
  } catch (error) {
    console.error("Cron job error:", error.message);
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
});
