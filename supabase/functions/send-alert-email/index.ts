// Edge Function: send-alert-email
// Receives payload from test-url and sends an email via Resend.

// This function expects secrets:
// - RESEND_API_KEY
// - RESEND_FROM (e.g., "Mission Control <alerts@your-domain>")

type AlertPayload = {
  type: "DOWN" | "UP";
  monitor: { id: string; name: string; url: string };
  to: string;
  probe?: { ok: boolean; status: number; ms: number; error?: string };
  incident_id?: string | null;
  occurred_at?: string;
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const RESEND_FROM = Deno.env.get("RESEND_FROM")!;
const RESEND_BASE = Deno.env.get("RESEND_API_BASE") || "https://api.resend.com";

function subjectFor(p: AlertPayload) {
  return p.type === "DOWN"
    ? `ALERT: ${p.monitor.name} is DOWN`
    : `RESOLVED: ${p.monitor.name} is back UP`;
}

function htmlFor(p: AlertPayload) {
  const probe = p.probe;
  const when = p.occurred_at ?? new Date().toISOString();
  const statusLine =
    p.type === "DOWN"
      ? `Service appears DOWN (HTTP ${probe?.status ?? "—"}).`
      : `Service appears UP (HTTP ${probe?.status ?? "—"}).`;
  const err = probe?.error ? `<pre style="white-space:pre-wrap">${probe.error}</pre>` : "";
  return `
  <div style="font-family:Inter,system-ui,Segoe UI,Arial,sans-serif;padding:16px">
    <h2 style="margin:0 0 8px">${subjectFor(p)}</h2>
    <p style="margin:4px 0"><strong>URL:</strong> <a href="${p.monitor.url}">${p.monitor.url}</a></p>
    <p style="margin:4px 0"><strong>Time:</strong> ${when}</p>
    <p style="margin:8px 0">${statusLine} Response time: ${probe?.ms ?? "—"} ms.</p>
    ${err}
    ${p.incident_id ? `<p style="margin:8px 0"><strong>Incident:</strong> ${p.incident_id}</p>` : ""}
    <hr style="margin:16px 0;border:none;border-top:1px solid #e5e7eb" />
    <p style="color:#6b7280;font-size:12px">You are receiving this because you monitor ${p.monitor.name}.</p>
  </div>`;
}

async function sendEmail(p: AlertPayload) {
  const res = await fetch(`${RESEND_BASE}/emails`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: RESEND_FROM,
      to: [p.to],
      subject: subjectFor(p),
      html: htmlFor(p),
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Resend API error ${res.status}: ${text.slice(0, 400)}`);
  }
  return await res.json().catch(() => ({}));
}

Deno.serve(async (req) => {
  let payload: AlertPayload | null = null;
  try {
    payload = (await req.json()) as AlertPayload;
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  // Loud receipt logs so you can see activity immediately
  console.log("send-alert-email received:", {
    type: payload?.type,
    monitor: payload?.monitor?.id,
    to: payload?.to,
  });

  if (!RESEND_API_KEY || !RESEND_FROM) {
    console.error("Missing RESEND secrets");
    return new Response("Server misconfigured (RESEND secrets)", { status: 500 });
    }

  if (!payload?.to || !payload?.monitor?.url || !payload?.type) {
    return new Response("Missing required fields", { status: 400 });
  }

  try {
    const out = await sendEmail(payload);
    console.log("Resend OK:", out);
    return new Response(JSON.stringify({ ok: true, id: out?.id ?? null }), {
      headers: { "content-type": "application/json" },
    });
  } catch (e: any) {
    console.error("Email send failed:", e?.message || e);
    return new Response(`Email send failed: ${e?.message || e}`, { status: 500 });
  }
});
