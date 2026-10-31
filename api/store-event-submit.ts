// Vercel serverless function: public "Submit a store event" form → Marketing Planner (Store Promotions) + email alert.
// Spam guards: hidden honeypot field, minimum fill time, size limits, and a cap on submissions per hour.
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tsrnpmkipdbtwyrlfbuy.supabase.co';
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const FROM = process.env.REPORT_FROM || 'Square Peg Connect <connect@updates.squarepegpizzeria.com>';
const APP_URL = 'https://connect.squarepegpizzeria.com';
const BUCKET = 'store-event-files';

// Keep in sync with src/lib/data.ts
const STORES: Record<string, string> = {
  'loc-1': 'Storrs', 'loc-2': 'Vernon', 'loc-3': 'Shelton', 'loc-4': 'Preston', 'loc-5': 'Glastonbury',
  'loc-6': 'East Hartford', 'loc-7': 'Plainville', 'loc-8': 'Delray Beach', 'loc-9': 'Berlin', 'loc-10': 'Bolton',
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' } });
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const str = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);
const isYmd = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
const isTime = (v: string) => !v || /^\d{2}:\d{2}$/.test(v);
const time12 = (t: string) => { if (!t) return ''; const [h, m] = t.split(':').map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`; };
const longDate = (v: string) => { const [y, m, d] = v.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }); };

export async function POST(request: Request): Promise<Response> {
  if (!SECRET_KEY) return json(500, { error: 'The form is not configured on the server.' });
  let b: any;
  try { b = await request.json(); } catch { return json(400, { error: 'Bad request.' }); }

  // Honeypot: real people never see or fill this field. Pretend it worked so bots move on.
  if (str(b.website, 200) || str(b.company_url, 200)) return json(200, { ok: true });
  // Bots submit instantly; people take at least a few seconds.
  const startedAt = Number(b.started_at || 0);
  if (!startedAt || Date.now() - startedAt < 4000) return json(200, { ok: true });

  const store = str(b.store, 20);
  const title = str(b.title, 200);
  const startDate = str(b.start_date, 10);
  const endDate = str(b.end_date, 10);
  const startTime = str(b.start_time, 5);
  const endTime = str(b.end_time, 5);
  const details = str(b.details, 5000);
  const links = str(b.links, 2000);
  const contactName = str(b.contact_name, 120);
  const contactEmail = str(b.contact_email, 200);
  if (!STORES[store]) return json(400, { error: 'Please pick your store.' });
  if (!title) return json(400, { error: 'Please give the event a name.' });
  if (!isYmd(startDate) || (endDate && !isYmd(endDate))) return json(400, { error: 'Please pick the event date.' });
  if (!isTime(startTime) || !isTime(endTime)) return json(400, { error: 'Please check the times.' });
  if (!contactName) return json(400, { error: 'Please add your name.' });

  // Only accept files that were uploaded into this form's folder.
  const files = (Array.isArray(b.files) ? b.files : []).slice(0, 20)
    .map((f: any) => ({ path: str(f?.path, 300), name: str(f?.name, 200), type: str(f?.type, 100), size: Number(f?.size) || 0 }))
    .filter((f: any) => /^uploads\/[A-Za-z0-9-]+\/[^/]+$/.test(f.path));

  const admin = createClient(SUPABASE_URL, SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

  // Flood guard: at most 30 store submissions per hour across all stores.
  const since = new Date(Date.now() - 3600 * 1000).toISOString();
  const { count } = await admin.from('marketing_campaigns').select('id', { count: 'exact', head: true }).eq('source', 'store_form').gte('created_at', since);
  if ((count || 0) >= 30) return json(429, { error: 'Too many submissions right now. Please try again in a little while.' });

  const attachments = files.map((f: any) => ({ ...f, url: admin.storage.from(BUCKET).getPublicUrl(f.path).data.publicUrl }));
  const when = [time12(startTime), time12(endTime)].filter(Boolean).join(' – ');
  const description = [
    `Store event submitted by ${contactName}${contactEmail ? ` (${contactEmail})` : ''}.`,
    when ? `Time: ${when}` : '',
    details ? `\nDetails:\n${details}` : '',
    links ? `\nLinks:\n${links}` : '',
    attachments.length ? `\nFiles:\n${attachments.map((a: any) => `${a.name}: ${a.url}`).join('\n')}` : '',
  ].filter(Boolean).join('\n');

  const row: Record<string, unknown> = {
    title, description, target_date: startDate, location_id: store, status: 'planning',
    attachments, submitted_by: contactEmail ? `${contactName} <${contactEmail}>` : contactName, source: 'store_form',
  };
  if (endDate && endDate > startDate) row.end_date = endDate;
  const { error } = await admin.from('marketing_campaigns').insert(row);
  if (error) return json(500, { error: 'Could not save your event. Please try again.' });

  // Alert the marketing team (same people as Marketing Support Requests).
  if (RESEND_API_KEY) {
    const { data: setting } = await admin.from('notification_settings').select('recipients').eq('key', 'marketing_requests').maybeSingle();
    const to = ((setting?.recipients as string[] | undefined) || []).filter((e) => /@/.test(e));
    if (to.length) {
      const block = (label: string, text: string) => text
        ? `<div style="font-size:13px;color:#6b7280;margin:12px 0 4px">${label}</div><div style="background:#f3f4f6;border-radius:6px;padding:10px 12px;font-size:14px;white-space:pre-wrap">${esc(text)}</div>` : '';
      const fileList = attachments.length
        ? `<div style="font-size:13px;color:#6b7280;margin:12px 0 4px">Files (${attachments.length})</div>${attachments.map((a: any) => `<div style="margin:2px 0"><a href="${esc(a.url)}">${esc(a.name)}</a></div>`).join('')}` : '';
      const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:580px;margin:0 auto;padding:24px;color:#111827">
        <h2 style="margin:0 0 4px">New store event to promote</h2>
        <div style="color:#6b7280;margin:0 0 14px">${esc(STORES[store])} · ${esc(longDate(startDate))}${endDate && endDate > startDate ? ` – ${esc(longDate(endDate))}` : ''}${when ? ` · ${esc(when)}` : ''}</div>
        <div style="font-size:18px;font-weight:bold;margin:0 0 6px">${esc(title)}</div>
        <div style="font-size:14px;color:#374151">Submitted by ${esc(contactName)}${contactEmail ? ` (${esc(contactEmail)})` : ''}</div>
        ${block('Details', details)}${block('Links', links)}${fileList}
        <p style="margin:20px 0 0"><a href="${APP_URL}/campaigns" style="background:#1f2937;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;display:inline-block;font-weight:bold">Open Store Promotions</a></p>
      </div>`;
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { authorization: `Bearer ${RESEND_API_KEY}`, 'content-type': 'application/json' },
        body: JSON.stringify({ from: FROM, to, subject: `Store event to promote: ${title} (${STORES[store]})`, html, ...(contactEmail ? { reply_to: contactEmail } : {}) }),
      }).catch(() => undefined);
    }
  }
  return json(200, { ok: true });
}
