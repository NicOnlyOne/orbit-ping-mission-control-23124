// supabase/functions/send-alert-email/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const RESEND_FROM = Deno.env.get("RESEND_FROM") ?? "Mission Control <alerts@your-domain>";
const REGION = Deno.env.get("RESEND_API_BASE") ?? "https://api.resend.com"; // set EU base if needed

type Payload = {
  type: "down" | "up";
  to: string | null | undefined;
  monitor: { id: string; name?: string | null; url: string };
  context?: Record<string, unknown>;
};

async function sendEmail(p: Payload) {
  if (!RESEND_API_KEY) throw new Error("Missing RESEND_API_KEY");
  if (!p.to) throw new Error("Missing recipient email 'to'");

  const subject =
    p.type === "down"
      ? `Blackout detected: ${p.monitor.name ?? p.monitor.url}`
      : `Orbit stable again: ${p.monitor.name ?? p.monitor.url}`;

  const html = `
  <div style="font-family:system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#e2e8f0;background:#0b1020;padding:24px;">
    <h1 style="margin:0 0 12px;color:#93c5fd;">Orbit Ping — Mission Control</h1>
    <p style="margin:0 0 8px;">Monitor: <strong>${p.monitor.name ?? p.monitor.url}</strong></p>
    <p style="margin:0 0 8px;">URL: <a style="color:#93c5fd" href="${p.monitor.url}">${p.monitor.url}</a></p>
    <p style="margin:0 0 8px;">Event: <strong>${p.type === "down" ? "Blackout (DOWN)" : "Recovered (UP)"}</strong></p>
    <pre style="white-space:pre-wrap;background:#0f172a;color:#cbd5e1;padding:12px;border-radius:8px;">${JSON.stringify(
      p.context ?? {},
      null,
      2,
    )}</pre>
    <p style="margin-top:16px;">You’re receiving this because you subscribed to Mission Control alerts.</p>
  </div>`;

  const res = await fetch(`${REGION}/emails`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: RESEND_FROM,
      to: [p.to],
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Resend error ${res.status}: ${txt}`);
  }

  const json = await res.json();
  return json;
}

serve(async (req) => {
  // Require Supabase JWT by default (internal invocation). Remove if you want it public.
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) {
    return new Response("Unauthorized", { status: 401 });
  }

  const raw = await req.text();
  let payload: Payload | null = null;
  try {
    payload = JSON.parse(raw || "{}");
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  console.log("send-alert-email received:", payload); // You’ll see this in Logs Explorer

  try {
    const result = await sendEmail(payload as Payload);
    return new Response(JSON.stringify({ ok: true, result }), { status: 200 });
  } catch (e) {
    console.error("send-email failed:", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500 });
  }
});
