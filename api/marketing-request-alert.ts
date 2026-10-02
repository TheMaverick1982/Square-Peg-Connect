// Vercel serverless function: emails the team when a Marketing Support Request comes in
// (public intake form or the in-app "Request Support" button).
// Public endpoint, so it only ever emails the fixed recipient list (notification_settings: marketing_requests),
// only for a real request saved in the last 15 minutes, and at most once per request.
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tsrnpmkipdbtwyrlfbuy.supabase.co';
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const FROM = process.env.REPORT_FROM || 'Square Peg Connect <connect@updates.squarepegpizzeria.com>';
const APP_URL = 'https://connect.squarepegpizzeria.com';

// Keep in sync with src/lib/data.ts
const LOCATION_NAMES: Record<string, string> = {
  "loc-1": "Storrs", "loc-2": "Vernon", "loc-3": "Shelton", "loc-4": "Preston", "loc-5": "Glastonbury",
  "loc-6": "East Hartford", "loc-7": "Plainville", "loc-8": "Delray Beach", "loc-9": "Berlin", "loc-10": "Bolton",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

export async function POST(request: Request): Promise<Response> {
  if (!SECRET_KEY || !RESEND_API_KEY) return json(500, { error: 'Email alerts are not configured on the server.' });
  let body: { event_name?: string };
  try { body = await request.json(); } catch { return json(400, { error: 'Bad request.' }); }
  const eventName = String(body.event_name || '').slice(0, 300);
  if (!eventName) return json(400, { error: 'Missing event name.' });

  const admin = createClient(SUPABASE_URL, SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { data: rows, error } = await admin.from('marketing_support_requests').select('*')
    .eq('event_name', eventName).is('alert_sent_at', null).gte('created_at', since)
    .order('created_at', { ascending: false }).limit(1);
  if (error) return json(500, { error: error.message });
  const req = rows?.[0];
  if (!req) return json(200, { ok: true, skipped: 'no recent request' });

  const { data: claimed } = await admin.from('marketing_support_requests')
    .update({ alert_sent_at: new Date().toISOString() }).eq('id', req.id).is('alert_sent_at', null).select('id');
  if (!claimed?.length) return json(200, { ok: true, skipped: 'already sent' });

  const { data: setting } = await admin.from('notification_settings').select('recipients').eq('key', 'marketing_requests').maybeSingle();
  const recipients = ((setting?.recipients as string[] | undefined) || []).filter((e) => /@/.test(e));
  if (!recipients.length) return json(200, { ok: true, skipped: 'no recipients configured' });

  const store = req.location_id ? (LOCATION_NAMES[req.location_id] || req.location_id) : 'All locations';
  const [y, m, d] = String(req.event_date || '').slice(0, 10).split('-').map(Number);
  const when = y ? new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : '';
  const block = (label: string, text?: string | null) => text
    ? `<div style="font-size:13px;color:#6b7280;margin:10px 0 4px">${label}</div><div style="background:#f3f4f6;border-radius:6px;padding:10px 12px;font-size:14px;white-space:pre-wrap">${esc(text)}</div>` : '';

  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111827">
    <h2 style="margin:0 0 4px">New marketing support request</h2>
    <div style="color:#6b7280;margin:0 0 14px">${esc(store)}${when ? ` · ${esc(when)}` : ''}</div>
    <div style="font-size:16px;font-weight:bold;margin:0 0 6px">${esc(req.event_name)}</div>
    ${block('Support needed', req.support_needed)}
    ${block('Links', req.external_links)}
    ${block('Notes', req.notes)}
    <p style="margin:18px 0 0"><a href="${APP_URL}/campaigns" style="background:#1f2937;color:#ffffff;padding:10px 18px;border-radius:6px;text-decoration:none;display:inline-block;font-weight:bold">Open Marketing Planner</a></p>
  </div>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: recipients, subject: `Marketing request: ${req.event_name} (${store})`, html }),
  });
  if (!res.ok) {
    await admin.from('marketing_support_requests').update({ alert_sent_at: null }).eq('id', req.id);
    console.error('Resend error', res.status, await res.text().catch(() => ''));
    return json(502, { error: 'Email service error.' });
  }
  return json(200, { ok: true, sent_to: recipients.length });
}
