// Vercel serverless function: emails the staff-photo alert after someone uploads photos
// on the public Staff Photo form. Replaces the old Vendasta-era Supabase function.
// Requires Vercel env vars SUPABASE_SECRET_KEY and RESEND_API_KEY.
// Recipients are managed in the app (Staff Photos → Email alerts), stored in notification_settings.
//
// Abuse protection: this endpoint is public (the form has no login), so it only ever emails the
// fixed recipient list, and only for a real submission saved in the last 15 minutes that hasn't
// been alerted yet. Each submission can trigger at most one email.
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tsrnpmkipdbtwyrlfbuy.supabase.co';
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const FROM = process.env.REPORT_FROM || 'Square Peg Connect <connect@updates.squarepegpizzeria.com>';
const APP_URL = 'https://connect.squarepegpizzeria.com';

// Keep in sync with src/lib/data.ts
const LOCATION_NAMES: Record<string, string> = {
  "loc-1": "Storrs",
  "loc-2": "Vernon",
  "loc-3": "Shelton",
  "loc-4": "Preston",
  "loc-5": "Glastonbury",
  "loc-6": "East Hartford",
  "loc-7": "Plainville",
  "loc-8": "Delray Beach",
  "loc-9": "Berlin",
  "loc-10": "Bolton",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const esc = (s: string) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

export async function POST(request: Request): Promise<Response> {
  if (!SECRET_KEY || !RESEND_API_KEY) return json(500, { error: 'Email alerts are not configured on the server.' });

  let body: { location_id?: string; staff_name?: string };
  try { body = await request.json(); } catch { return json(400, { error: 'Bad request.' }); }
  const locationId = String(body.location_id || '');
  const staffName = String(body.staff_name || '').slice(0, 200);
  if (!locationId) return json(400, { error: 'Missing location.' });

  const admin = createClient(SUPABASE_URL, SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

  const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  let q = admin.from('staff_photo_submissions').select('*')
    .eq('location_id', locationId).is('alert_sent_at', null).gte('created_at', since)
    .order('created_at', { ascending: false }).limit(1);
  if (staffName) q = q.eq('staff_name', staffName);
  const { data: subs, error: subErr } = await q;
  if (subErr) return json(500, { error: subErr.message });
  const sub = subs?.[0];
  if (!sub) return json(200, { ok: true, skipped: 'no recent submission' });

  // Claim it first so two calls can't both send.
  const { data: claimed } = await admin.from('staff_photo_submissions')
    .update({ alert_sent_at: new Date().toISOString() }).eq('id', sub.id).is('alert_sent_at', null).select('id');
  if (!claimed?.length) return json(200, { ok: true, skipped: 'already sent' });

  const { data: setting } = await admin.from('notification_settings').select('recipients').eq('key', 'staff_photos').maybeSingle();
  const recipients = ((setting?.recipients as string[] | undefined) || []).filter((e) => /@/.test(e));
  if (!recipients.length) return json(200, { ok: true, skipped: 'no recipients configured' });

  const photos: string[] = Array.isArray(sub.photo_urls) ? sub.photo_urls : [];
  const storeName = LOCATION_NAMES[sub.location_id] || sub.location_id;
  const thumbs = photos.slice(0, 12).map((u) =>
    `<a href="${esc(u)}" style="display:inline-block;margin:0 6px 6px 0"><img src="${esc(u)}" width="120" height="120" alt="Staff photo" style="width:120px;height:120px;object-fit:cover;border-radius:6px;border:1px solid #e5e7eb"></a>`
  ).join('');

  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111827">
    <h2 style="margin:0 0 4px">New staff photos uploaded</h2>
    <div style="color:#6b7280;margin:0 0 16px">${esc(storeName)} · ${photos.length} photo${photos.length === 1 ? '' : 's'}</div>
    <table style="font-size:14px;border-collapse:collapse;margin:0 0 16px">
      <tr><td style="padding:2px 12px 2px 0;color:#6b7280">From</td><td style="padding:2px 0;font-weight:bold">${esc(sub.staff_name || '—')}</td></tr>
      <tr><td style="padding:2px 12px 2px 0;color:#6b7280">Store</td><td style="padding:2px 0;font-weight:bold">${esc(storeName)}</td></tr>
      ${sub.notes ? `<tr><td style="padding:2px 12px 2px 0;color:#6b7280;vertical-align:top">Notes</td><td style="padding:2px 0">${esc(sub.notes)}</td></tr>` : ''}
    </table>
    <div style="margin:0 0 16px">${thumbs}</div>
    <a href="${APP_URL}/staff-photos" style="background:#1f2937;color:#ffffff;padding:10px 18px;border-radius:6px;text-decoration:none;display:inline-block;font-weight:bold">View in Connect</a>
  </div>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: FROM, to: recipients,
      subject: `New staff photos — ${storeName}${sub.staff_name ? ` (${sub.staff_name})` : ''}`,
      html,
    }),
  });
  if (!res.ok) {
    // Release the claim so a retry can send.
    await admin.from('staff_photo_submissions').update({ alert_sent_at: null }).eq('id', sub.id);
    const detail = await res.text().catch(() => '');
    console.error('Resend error', res.status, detail);
    return json(502, { error: 'Email service error.' });
  }
  return json(200, { ok: true, sent_to: recipients.length });
}
