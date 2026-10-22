// Vercel serverless function: emails for Kids Pizza Class signups.
//  - mode "new"     (public form): alerts the team + that store about a signup saved in the last 15 minutes, once per signup.
//  - mode "details" (signed-in team member): emails one signup's details to its store.
// Public mode only ever emails fixed internal addresses, so it can't be used to send mail elsewhere.
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tsrnpmkipdbtwyrlfbuy.supabase.co';
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const FROM = process.env.REPORT_FROM || 'Square Peg Connect <connect@updates.squarepegpizzeria.com>';
const APP_URL = 'https://connect.squarepegpizzeria.com';
const TEAM = ['hr@squarepegpizzeria.com', 'catering@squarepegpizzeria.com'];

// Keep in sync with src/lib/data.ts
const STORES: Record<string, { name: string; email: string }> = {
  'loc-1': { name: 'Storrs', email: 'storrs@squarepegpizzeria.com' },
  'loc-2': { name: 'Vernon', email: 'vernon@squarepegpizzeria.com' },
  'loc-3': { name: 'Shelton', email: 'shelton@squarepegpizzeria.com' },
  'loc-4': { name: 'Preston', email: 'preston@squarepegpizzeria.com' },
  'loc-5': { name: 'Glastonbury', email: 'glastonbury@squarepegpizzeria.com' },
  'loc-6': { name: 'East Hartford', email: 'ehartford@squarepegpizzeria.com' },
  'loc-7': { name: 'Plainville', email: 'plainville@squarepegpizzeria.com' },
  'loc-8': { name: 'Delray Beach', email: 'delraybeach@squarepegpizzeria.com' },
  'loc-9': { name: 'Berlin', email: 'berlin@squarepegpizzeria.com' },
  'loc-10': { name: 'Bolton', email: 'bolton@squarepegpizzeria.com' },
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const longDate = (v: unknown) => {
  const [y, m, d] = String(v ?? '').slice(0, 10).split('-').map(Number);
  return y ? new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : '';
};
const time12 = (t?: string | null) => {
  if (!t) return '';
  const [h, mi] = t.split(':').map(Number);
  if (Number.isNaN(h)) return t;
  return `${((h + 11) % 12) + 1}:${String(mi || 0).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};

function buildHtml(r: any, heading: string, intro: string) {
  const store = STORES[r.location]?.name || r.location || 'Unknown store';
  const time = [time12(r.time_start), time12(r.time_finish)].filter(Boolean).join(' – ');
  const row = (label: string, value: unknown) => value || value === 0
    ? `<p style="margin:5px 0"><strong>${label}:</strong> ${esc(value)}</p>` : '';
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#111827;line-height:1.5">
    <div style="text-align:center;margin-bottom:16px"><img src="${APP_URL}/square-peg-logo.png" alt="Square Peg Pizzeria" style="max-height:70px" /></div>
    <h2 style="margin:0 0 6px">${esc(heading)}</h2>
    <p style="margin:0 0 14px;color:#374151">${intro}</p>
    <div style="background:#f9fafb;border-radius:8px;padding:14px 16px">
      ${row('Store', store)}
      ${row('Date', longDate(r.event_date))}
      ${row('Time', time)}
      ${row('Number of kids', r.guest_count)}
      ${row('Parent / guardian', r.name)}
      ${row('Email', r.email)}
      ${row('Phone', r.phone)}
      ${row('Organization / school', r.organization)}
      ${r.requires_room ? row('Private room needed', 'Yes') : ''}
      ${row('Heard about us', r.heard_about_us)}
      ${row('Source', r.lead_source)}
    </div>
    ${r.notes ? `<h4 style="margin:16px 0 4px">Notes</h4><div style="border-left:4px solid #ddd;padding:8px 12px;white-space:pre-wrap">${esc(r.notes)}</div>` : ''}
    <p style="margin:20px 0 0"><a href="${APP_URL}/kids-classes" style="background:#1f2937;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;display:inline-block;font-weight:bold">Open Kids Pizza Classes</a></p>
  </div>`;
}

async function send(to: string[], subject: string, html: string, replyTo?: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: Array.from(new Set(to)), subject, html, ...(replyTo ? { reply_to: replyTo } : {}) }),
  });
  if (!res.ok) console.error('Resend error', res.status, await res.text().catch(() => ''));
  return res.ok;
}

export async function POST(request: Request): Promise<Response> {
  if (!SECRET_KEY || !RESEND_API_KEY) return json(500, { error: 'Email is not configured on the server.' });
  let body: { mode?: string; id?: string; email?: string };
  try { body = await request.json(); } catch { return json(400, { error: 'Bad request.' }); }
  const admin = createClient(SUPABASE_URL, SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

  if (body.mode === 'details') {
    const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    if (!token) return json(401, { error: 'Not signed in.' });
    const { data: caller } = await admin.auth.getUser(token);
    const callerEmail = caller?.user?.email?.toLowerCase();
    if (!callerEmail) return json(401, { error: 'Session expired. Sign in again.' });
    const { data: profiles } = await admin.from('employee_profiles').select('email,status');
    if (!(profiles || []).some((p) => (p.email || '').trim().toLowerCase() === callerEmail && p.status !== 'disabled'))
      return json(403, { error: 'Not on the team list.' });

    const { data: r, error } = await admin.from('kids_classes').select('*').eq('id', String(body.id || '')).maybeSingle();
    if (error) return json(500, { error: error.message });
    if (!r) return json(404, { error: 'Signup not found.' });
    const store = STORES[r.location];
    if (!store) return json(400, { error: 'This signup has no store selected.' });
    const ok = await send([store.email], `Kids Pizza Class: ${longDate(r.event_date)} · ${r.guest_count || '?'} kids`,
      buildHtml(r, 'Kids Pizza Class details', `Here are the details for an upcoming kids pizza class at ${esc(store.name)}.`), r.email || undefined);
    return ok ? json(200, { ok: true }) : json(502, { error: 'Email service error.' });
  }

  // mode "new": public form just saved a signup.
  const email = String(body.email || '').trim().slice(0, 200);
  if (!email) return json(400, { error: 'Missing email.' });
  const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { data: rows, error } = await admin.from('kids_classes').select('*')
    .ilike('email', email).is('alert_sent_at', null).gte('created_at', since)
    .order('created_at', { ascending: false }).limit(1);
  if (error) return json(500, { error: error.message });
  const r = rows?.[0];
  if (!r) return json(200, { ok: true, skipped: 'no recent signup' });
  const { data: claimed } = await admin.from('kids_classes')
    .update({ alert_sent_at: new Date().toISOString() }).eq('id', r.id).is('alert_sent_at', null).select('id');
  if (!claimed?.length) return json(200, { ok: true, skipped: 'already sent' });

  const store = STORES[r.location];
  const to = [...TEAM, ...(store ? [store.email] : [])];
  const ok = await send(to, `New Kids Pizza Class request: ${store?.name || 'Unknown store'} - ${longDate(r.event_date)}`,
    buildHtml(r, 'New Kids Pizza Class Request', 'A new kids pizza class request came in and was added to Connect as <strong>Requested</strong>.'), r.email || undefined);
  if (!ok) {
    await admin.from('kids_classes').update({ alert_sent_at: null }).eq('id', r.id);
    return json(502, { error: 'Email service error.' });
  }
  return json(200, { ok: true });
}
