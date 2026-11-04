// Vercel serverless function: emails for catering orders, Tuesday fundraisers, large reservations and kids pizza classes.
//  - mode "new"   (public forms): the team + the assigned store hear about a request saved in the last 15 minutes, once.
//  - mode "store" (signed-in team member): (re)sends one request's details to its store, with any attachments.
// Public mode only ever emails fixed internal addresses, so it can't be used to send mail elsewhere.
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tsrnpmkipdbtwyrlfbuy.supabase.co';
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const FROM = process.env.REPORT_FROM || 'Square Peg Connect <connect@updates.squarepegpizzeria.com>';
const APP_URL = 'https://connect.squarepegpizzeria.com';
const TEAM = ['hr@squarepegpizzeria.com', 'catering@squarepegpizzeria.com'];

// Keep in sync with src/lib/data.ts
const STORES: Record<string, { name: string; email: string; address?: string; phone?: string }> = {
  'loc-1': { name: 'Storrs', email: 'storrs@squarepegpizzeria.com', address: '9 Dog Ln, Storrs, CT 06268', phone: '(860) 454-6038' },
  'loc-2': { name: 'Vernon', email: 'vernon@squarepegpizzeria.com', address: '226 Talcottville Rd, Vernon, CT 06066', phone: '(860) 926-0088' },
  'loc-3': { name: 'Shelton', email: 'shelton@squarepegpizzeria.com', address: '320 Howe Ave, Unit 6, Shelton, CT 06484', phone: '(203) 538-5044' },
  'loc-4': { name: 'Preston', email: 'preston@squarepegpizzeria.com', address: '353 CT-165, Preston, CT 06365', phone: '(860) 319-0930' },
  'loc-5': { name: 'Glastonbury', email: 'glastonbury@squarepegpizzeria.com', address: '1001 Hebron Ave, Glastonbury, CT 06033', phone: '(860) 286-0415' },
  'loc-6': { name: 'East Hartford', email: 'ehartford@squarepegpizzeria.com', address: '130 Long Hill St, East Hartford, CT 06108', phone: '(860) 509-4221' },
  'loc-7': { name: 'Plainville', email: 'plainville@squarepegpizzeria.com', address: '400 New Britain Ave, Plainville, CT 06062', phone: '(860) 996-0363' },
  'loc-8': { name: 'Delray Beach', email: 'delraybeach@squarepegpizzeria.com', address: '4957 W Atlantic Ave, Delray Beach, FL 33445', phone: '(561) 566-8828' },
  'loc-9': { name: 'Berlin', email: 'berlin@squarepegpizzeria.com', address: '151 Webster Square Rd, Berlin, CT 06037', phone: '(860) 505-4072' },
  'loc-10': { name: 'Bolton', email: 'bolton@squarepegpizzeria.com', address: '270 West St, Bolton, CT 06043', phone: '(860) 791-7109' },
  'loc-11': { name: 'Food Truck', email: 'catering@squarepegpizzeria.com' },
};

type Kind = 'catering' | 'fundraiser' | 'large_reservation' | 'kids_class';
const KINDS: Record<Kind, { table: string; label: string; page: string; color: string }> = {
  catering: { table: 'catering_requests', label: 'Catering Request', page: 'catering', color: '#16a34a' },
  fundraiser: { table: 'fundraisers', label: 'Tuesday Fundraiser Request', page: 'tuesday-fundraisers', color: '#db2777' },
  large_reservation: { table: 'large_reservations', label: 'Large Reservation Request', page: 'large-reservations', color: '#2563eb' },
  kids_class: { table: 'kids_classes', label: 'Private Kids Pizza Class Request', page: 'kids-classes', color: '#ca8a04' },
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
  const [h, mi] = String(t).split(':').map(Number);
  if (Number.isNaN(h)) return String(t);
  return `${((h + 11) % 12) + 1}:${String(mi || 0).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};
const money = (n: unknown) => { const v = Number(n); return v ? `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''; };

function render(kind: Kind, r: any, mode: 'new' | 'store') {
  const k = KINDS[kind];
  const store = STORES[r.location];
  const org = r.company || r.organization;
  const time = kind === 'catering' ? time12(r.pickup_time) : [time12(r.time_start), time12(r.time_finish)].filter(Boolean).join(' – ');
  const files: any[] = Array.isArray(r.attachments) ? r.attachments : [];
  const row = (label: string, value: unknown) => (value || value === 0) && value !== ''
    ? `<tr><td style="padding:5px 12px 5px 0;color:#6b7280;white-space:nowrap;vertical-align:top">${label}</td><td style="padding:5px 0;font-weight:bold">${esc(value)}</td></tr>` : '';
  const heading = mode === 'new' ? `New ${k.label}` : `${k.label.replace(/ Request$/, '')} details`;
  const intro = mode === 'new'
    ? `A new request came in for <b>${esc(store?.name || 'an unassigned store')}</b> and was added to Connect as <b>${esc(r.status || 'Requested')}</b>.`
    : `Here are the details for this ${({ catering: 'catering order', fundraiser: 'Tuesday fundraiser', large_reservation: 'large reservation', kids_class: 'private kids pizza class' } as Record<Kind, string>)[kind]} at <b>${esc(store?.name || '')}</b>.`;
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#111827;line-height:1.5">
    <div style="text-align:center;margin-bottom:16px"><img src="${APP_URL}/square-peg-logo.png" alt="Square Peg Pizzeria" style="max-height:70px" /></div>
    <div style="height:4px;background:${k.color};border-radius:2px;margin:0 0 14px"></div>
    <h2 style="margin:0 0 6px">${esc(heading)}</h2>
    <p style="margin:0 0 14px;color:#374151">${intro}</p>
    <table style="width:100%;border-collapse:collapse;background:#f9fafb;border-radius:8px;padding:12px;font-size:14px">
      ${row('Store', store?.name)}
      ${row('Event type', r.event_type)}
      ${row('Date', longDate(r.event_date))}
      ${row(kind === 'catering' ? 'Pickup / ready time' : 'Time', time)}
      ${row(kind === 'kids_class' ? 'Number of kids' : 'Guests', r.guest_count)}
      ${row('Order preference', r.order_preference)}
      ${row('Name', r.name)}
      ${row(kind === 'catering' ? 'Company / event' : 'Organization', org)}
      ${row('Email', r.email)}
      ${row('Phone', r.phone)}
      ${row('Address', kind === 'fundraiser' ? r.address : '')}
      ${row('Check payable to', kind === 'fundraiser' ? r.payable_to : '')}
      ${r.requires_room ? row('Private room needed', 'Yes') : ''}
      ${r.paid_by_invoice ? row('Payment', 'Paid by invoice') : ''}
      ${row('Deposit', money(r.deposit_amount) ? `${money(r.deposit_amount)}${r.deposit_paid ? ' (paid)' : ' (not paid yet)'}` : '')}
      ${row('Quote total', kind === 'catering' ? money(r.quote_total) : '')}
      ${row('Heard about us', r.heard_about_us)}
      ${row('Source', r.lead_source)}
    </table>
    ${r.notes ? `<h4 style="margin:16px 0 4px">Notes</h4><div style="border-left:4px solid #ddd;padding:8px 12px;white-space:pre-wrap">${esc(r.notes)}</div>` : ''}
    ${files.length ? `<h4 style="margin:16px 0 4px">Attachments (${files.length})</h4>${files.map((f) => `<div><a href="${esc(f.url)}">${esc(f.name)}</a></div>`).join('')}
      <div style="font-size:12px;color:#6b7280;margin-top:4px">The files are also attached to this email.</div>` : ''}
    <p style="margin:20px 0 0"><a href="${APP_URL}/${k.page}" style="background:#1f2937;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;display:inline-block;font-weight:bold">Open in Connect</a></p>
  </div>`;
  const what = org || r.name || 'Request';
  const subject = mode === 'new'
    ? `New ${k.label.replace(/ Request$/, '')} request: ${what} · ${store?.name || 'No store'} · ${longDate(r.event_date)}`
    : `${k.label.replace(/ Request$/, '')}: ${what} · ${longDate(r.event_date)}${time ? ` · ${time}` : ''}`;
  // Attach files (Resend downloads them from their links). Keep it under email size limits.
  let total = 0;
  const attachments = files.filter((f) => { total += Number(f.size) || 0; return f.url && total <= 25 * 1024 * 1024; })
    .map((f) => ({ filename: String(f.name || 'file'), path: String(f.url) }));
  return { subject, html, attachments };
}

async function send(to: string[], replyTo: string | undefined, msg: ReturnType<typeof render>) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: FROM, to: Array.from(new Set(to.map((e) => e.toLowerCase()))), subject: msg.subject, html: msg.html,
      ...(msg.attachments.length ? { attachments: msg.attachments } : {}), ...(replyTo ? { reply_to: replyTo } : {}),
    }),
  });
  if (!res.ok) console.error('Resend error', res.status, await res.text().catch(() => ''));
  return res.ok;
}

export async function POST(request: Request): Promise<Response> {
  if (!SECRET_KEY || !RESEND_API_KEY) return json(500, { error: 'Email is not configured on the server.' });
  let body: { mode?: string; kind?: string; id?: string | number; email?: string };
  try { body = await request.json(); } catch { return json(400, { error: 'Bad request.' }); }
  const kind = body.kind as Kind;
  if (!KINDS[kind]) return json(400, { error: 'Unknown request type.' });
  const table = KINDS[kind].table;
  const admin = createClient(SUPABASE_URL, SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

  if (body.mode === 'store') {
    const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    if (!token) return json(401, { error: 'Not signed in.' });
    const { data: caller } = await admin.auth.getUser(token);
    const me = caller?.user?.email?.toLowerCase();
    if (!me) return json(401, { error: 'Session expired. Sign in again.' });
    const { data: profiles } = await admin.from('employee_profiles').select('email,status');
    if (!(profiles || []).some((p: any) => (p.email || '').trim().toLowerCase() === me && p.status !== 'disabled'))
      return json(403, { error: 'Not on the team list.' });
    const { data: r, error } = await admin.from(table).select('*').eq('id', body.id as any).maybeSingle();
    if (error) return json(500, { error: error.message });
    if (!r) return json(404, { error: 'Request not found.' });
    const store = STORES[r.location];
    if (!store) return json(400, { error: 'This request has no store assigned yet.' });
    const ok = await send([store.email], r.email || undefined, render(kind, r, 'store'));
    return ok ? json(200, { ok: true, to: store.email, store: store.name }) : json(502, { error: 'Email service error.' });
  }

  // mode "new": a public form just saved a request.
  const email = String(body.email || '').trim().slice(0, 200);
  if (!email) return json(400, { error: 'Missing email.' });
  const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { data: rows, error } = await admin.from(table).select('*')
    .ilike('email', email.replace(/[%_\\]/g, (m) => `\\${m}`)).is('alert_sent_at', null).gte('created_at', since)
    .order('created_at', { ascending: false }).limit(1);
  if (error) return json(500, { error: error.message });
  const r = rows?.[0];
  if (!r) return json(200, { ok: true, skipped: 'no recent request' });
  const { data: claimed } = await admin.from(table).update({ alert_sent_at: new Date().toISOString() }).eq('id', r.id).is('alert_sent_at', null).select('id');
  if (!claimed?.length) return json(200, { ok: true, skipped: 'already sent' });
  const store = STORES[r.location];
  const ok = await send([...TEAM, ...(store ? [store.email] : [])], r.email || undefined, render(kind, r, 'new'));
  if (!ok) {
    await admin.from(table).update({ alert_sent_at: null }).eq('id', r.id);
    return json(502, { error: 'Email service error.' });
  }
  return json(200, { ok: true });
}
