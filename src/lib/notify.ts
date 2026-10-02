import { supabase } from "./supabase";

/** Sends a Marketing Planner email through our server (Resend). Returns false instead of throwing on failure. */
export async function notifyMarketing(body: Record<string, unknown>): Promise<{ ok: boolean; error?: string; skipped?: string }> {
  try {
    const { data } = await supabase.auth.getSession();
    const res = await fetch("/api/marketing-notify", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${data.session?.access_token ?? ""}` },
      body: JSON.stringify(body),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) { console.error("Email notification failed:", out.error || res.status); return { ok: false, error: out.error || `Request failed (${res.status})` }; }
    return { ok: true, skipped: out.skipped };
  } catch (e) {
    console.error("Email notification failed:", e);
    return { ok: false, error: (e as Error).message };
  }
}

/** Alerts the marketing inbox about a new support request (works for the public form too). */
export async function alertMarketingRequest(eventName: string): Promise<void> {
  try {
    const res = await fetch("/api/marketing-request-alert", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event_name: eventName }),
    });
    if (!res.ok) console.error("Marketing request alert failed:", await res.text());
  } catch (e) {
    console.error("Marketing request alert failed:", e);
  }
}
