import { supabase } from "@/lib/supabase";

export type LeadKind = "catering" | "fundraiser" | "large_reservation" | "kids_class";

/** Public forms: tell the team + the assigned store about a request that was just saved. Never throws. */
export async function alertNewLead(kind: LeadKind, email: string) {
  try {
    await fetch("/api/lead-email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: "new", kind, email }),
    });
  } catch { /* the request is saved even if the email fails */ }
}

/** Team: (re)send a request's details (and attachments) to its store. */
export async function emailToStore(kind: LeadKind, id: string | number): Promise<{ store: string; to: string }> {
  const { data: sess } = await supabase.auth.getSession();
  const res = await fetch("/api/lead-email", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${sess.session?.access_token || ""}` },
    body: JSON.stringify({ mode: "store", kind, id }),
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok || d.error) throw new Error(d.error || `Request failed (${res.status})`);
  return d;
}

/** Team: email the guest that their booking is confirmed (with the store's address and phone). */
export async function emailGuest(kind: LeadKind, id: string | number): Promise<{ to: string }> {
  const { data: sess } = await supabase.auth.getSession();
  const res = await fetch("/api/lead-email", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${sess.session?.access_token || ""}` },
    body: JSON.stringify({ mode: "guest", kind, id }),
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok || d.error) throw new Error(d.error || `Request failed (${res.status})`);
  return d;
}

export type GuestPrompt = {
  kind: LeadKind;
  id: string | number;
  name?: string;
  email?: string | null;
  /** Use a different email (e.g. the fundraiser confirmation with promo assets). Defaults to emailGuest. */
  send?: () => Promise<void>;
};

/** After a request is marked Confirmed: ask whether to email the guest. Shown by <GuestConfirmPrompt /> (mounted in App). */
export function askToEmailGuest(p: GuestPrompt) {
  if (!p.email) return;
  window.dispatchEvent(new CustomEvent<GuestPrompt>("ask-email-guest", { detail: p }));
}
