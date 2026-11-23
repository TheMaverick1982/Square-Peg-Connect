// Vercel serverless function: emails for catering orders, Tuesday fundraisers, large reservations and kids pizza classes.
//  - mode "new"   (public forms): the team + the assigned store hear about a request saved in the last 15 minutes, once.
//  - mode "store" (signed-in team member): (re)sends one request's details to its store, with any attachments.
//  - mode "guest" (signed-in team member): emails the guest that their booking is confirmed, with the store's details.
//  - GET ?key=INBOX_SYNC_SECRET (pg_cron, 8am Eastern): each store gets the day's events. Add &force=1 to send at any hour,
//    &store=loc-N to send one store only, &to=you@x.com to send the emails to yourself instead (for testing).
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

const REPLY_TO = 'catering@squarepegpizzeria.com';
// Guests see the restaurant's name as the sender (same sending address).
const GUEST_FROM = `Square Peg Pizzeria <${(FROM.match(/<([^>]+)>/) || [])[1] || FROM}>`;
const NOUN: Record<Kind, string> = { catering: 'catering order', fundraiser: 'Tuesday fundraiser', large_reservation: 'large group reservation', kids_class: 'private kids pizza class' };

function renderGuest(kind: Kind, r: any) {
  const store = STORES[r.location];
  const org = r.company || r.organization;
  const isCatering = kind === 'catering';
  const delivery = isCatering && /deliver/i.test(String(r.order_preference || ''));
  const time = isCatering ? time12(r.pickup_time) : [time12(r.time_start), time12(r.time_finish)].filter(Boolean).join(' – ');
  const maps = store?.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`Square Peg Pizzeria ${store.address}`)}` : '';
  const row = (label: string, value: unknown) => (value || value === 0) && value !== ''
    ? `<tr><td style="padding:5px 12px 5px 0;color:#6b7280;white-space:nowrap;vertical-align:top">${label}</td><td style="padding:5px 0;font-weight:bold">${esc(value)}</td></tr>` : '';
  const first = String(r.name || '').trim().split(/\s+/)[0];
  const deposit = money(r.deposit_amount);
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#111827;line-height:1.5">
    <div style="text-align:center;margin-bottom:16px"><img src="${APP_URL}/square-peg-logo.png" alt="Square Peg Pizzeria" style="max-height:80px" />
      <div><a href="https://squarepegpizzeria.com" style="color:#666;text-decoration:none;font-size:14px">squarepegpizzeria.com</a></div></div>
    <h2 style="margin:0 0 10px;color:#111">Your ${esc(NOUN[kind])} is confirmed!</h2>
    <p style="margin:0 0 12px">Hi ${esc(first || 'there')},</p>
    <p style="margin:0 0 16px">Thanks for choosing Square Peg Pizzeria. Here are the details we have for your ${esc(NOUN[kind])}${org ? ` for <b>${esc(org)}</b>` : ''}. Please look them over and let us know if anything needs to change.</p>
    <div style="background:#f9f9f9;padding:15px;border-radius:8px;margin:0 0 18px">
      <h3 style="margin:0 0 8px;color:#AD1A0D">Details</h3>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        ${row('Date', longDate(r.event_date))}
        ${row(isCatering ? (delivery ? 'Delivery time' : 'Pickup time') : 'Time', time)}
        ${row(isCatering ? 'Order' : '', isCatering ? r.order_preference : '')}
        ${row('Event', r.event_type)}
        ${row(kind === 'kids_class' ? 'Number of kids' : 'Guests', r.guest_count)}
        ${r.requires_room ? row('Private room', 'Requested') : ''}
        ${row('Order total', isCatering ? money(r.quote_total) : '')}
        ${row('Deposit', deposit ? `${deposit}${r.deposit_paid ? ' (received, thank you)' : ' (due)'}` : '')}
      </table>
    </div>
    ${store?.address ? `<div style="background:#f9f9f9;padding:15px;border-radius:8px;margin:0 0 18px">
      <h3 style="margin:0 0 8px;color:#AD1A0D">${delivery ? 'Your store' : 'Where'}</h3>
      <div style="font-weight:bold">Square Peg Pizzeria${store.address ? ` – ${esc(store.name)}` : ''}</div>
      ${store.address ? `<div>${esc(store.address)}</div>` : ''}
      ${store.phone ? `<div>${esc(store.phone)}</div>` : ''}
      ${maps ? `<div style="margin-top:6px"><a href="${maps}" style="color:#AD1A0D">Get directions</a></div>` : ''}
    </div>` : ''}
    <p style="margin:0 0 8px">Questions or changes? Just reply to this email${store?.phone ? ` or call the store at ${esc(store.phone)}` : ''}.</p>
    <p style="margin:16px 0 0">See you soon!<br/><b>The Square Peg Pizzeria team</b></p>
  </div>`;
  const subject = `Confirmed: your ${NOUN[kind]} at Square Peg${store?.address ? ` ${store.name}` : ''} · ${longDate(r.event_date)}${time ? ` · ${time}` : ''}`;
  return { subject, html, attachments: [] as { filename: string; path: string }[] };
}

async function send(to: string[], replyTo: string | undefined, msg: ReturnType<typeof render>, from = FROM) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from, to: Array.from(new Set(to.map((e) => e.toLowerCase()))), subject: msg.subject, html: msg.html,
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

  if (body.mode === 'store' || body.mode === 'guest') {
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
    if (body.mode === 'guest') {
      const to = String(r.email || '').trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return json(400, { error: 'This request has no guest email address.' });
      const ok = await send([to], REPLY_TO, renderGuest(kind, r), GUEST_FROM);
      if (!ok) return json(502, { error: 'Email service error.' });
      await admin.from(table).update({ guest_emailed_at: new Date().toISOString() }).eq('id', r.id).then(() => {}, () => {});
      return json(200, { ok: true, to });
    }
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

// ---------- Morning-of reminders (GET, called by pg_cron at 12:00 and 13:00 UTC; only sends at 8am Eastern) ----------
const TZ = 'America/New_York';
const nyParts = (d: Date) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', weekday: 'short' })
    .formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) };
};
const nyClock = (iso: string) => { // a timestamp shown as Eastern wall-clock time
  const d = new Date(iso);
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    .formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: time12(`${p.hour}:${p.minute}`) };
};
/** Does a (possibly repeating) entertainment event happen on `day` (yyyy-mm-dd, Eastern)? */
function entertainmentOn(row: any, day: string): string | null {
  if (!row.start_date) return null;
  const first = nyClock(row.start_date);
  if (first.date === day) return first.time;
  if (!row.is_recurring || day < first.date) return null;
  const end = !row.no_end_date && row.recurrence_end_date ? String(row.recurrence_end_date).slice(0, 10) : '9999-12-31';
  if (day > end) return null;
  const a = new Date(`${first.date}T12:00:00Z`), b = new Date(`${day}T12:00:00Z`);
  if (row.recurrence_pattern === 'weekly') return Math.round((b.getTime() - a.getTime()) / 86400000) % 7 === 0 ? first.time : null;
  if (row.recurrence_pattern === 'monthly') return a.getUTCDate() === b.getUTCDate() ? first.time : null;
  return null;
}

type Item = { sort: string; color: string; label: string; title: string; time?: string; lines: [string, unknown][]; notes?: string; page?: string };

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const key = url.searchParams.get('key') || '';
  const auth = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const okKey = (process.env.INBOX_SYNC_SECRET && key === process.env.INBOX_SYNC_SECRET) || (process.env.CRON_SECRET && auth === process.env.CRON_SECRET);
  if (!okKey) return json(401, { error: 'Not allowed.' });
  if (!SECRET_KEY || !RESEND_API_KEY) return json(500, { error: 'Email is not configured on the server.' });
  const now = nyParts(new Date());
  const force = url.searchParams.get('force') === '1';
  if (!force && now.hour !== 8) return json(200, { ok: true, skipped: `It is ${now.hour}:00 in Connecticut; reminders go at 8am.` });
  const day = /^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get('date') || '') ? url.searchParams.get('date')! : now.date;
  const onlyStore = url.searchParams.get('store') || '';
  const testTo = (url.searchParams.get('to') || '').trim();
  const admin = createClient(SUPABASE_URL, SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

  const [cat, fun, lr, kc, se, ent, mk] = await Promise.all([
    admin.from('catering_requests').select('*').eq('event_date', day).eq('status', 'Confirmed'),
    admin.from('fundraisers').select('*').is('deleted_at', null).eq('event_date', day).eq('status', 'Confirmed'),
    admin.from('large_reservations').select('*').is('deleted_at', null).eq('event_date', day).eq('status', 'Confirmed'),
    admin.from('kids_classes').select('*').is('deleted_at', null).eq('event_date', day).eq('status', 'Confirmed'),
    admin.from('store_events').select('*').is('deleted_at', null).eq('event_date', day),
    admin.from('events').select('*'),
    admin.from('marketing_campaigns').select('*').is('archived_at', null).eq('show_on_calendar', true),
  ]);
  const byStore: Record<string, Item[]> = {};
  const add = (loc: string | null | undefined, it: Item) => { if (loc && STORES[loc]) (byStore[loc] ||= []).push(it); };
  const t24 = (t?: string | null) => (t ? String(t).slice(0, 5) : '99:99');
  const contact = (r: any): [string, unknown][] => [['Contact', [r.name, r.phone].filter(Boolean).join(' · ')], ['Email', r.email]];

  for (const r of cat.data || []) add(r.location, { sort: t24(r.pickup_time), color: KINDS.catering.color, label: 'Catering', page: KINDS.catering.page,
    title: r.company || r.name, time: time12(r.pickup_time) ? `${/deliver/i.test(r.order_preference || '') ? 'Delivery' : 'Pickup'} ${time12(r.pickup_time)}` : '',
    lines: [['Order', r.order_preference], ['Event', r.event_type], ['Guests', r.guest_count], ['Total', money(r.quote_total)], ...contact(r)], notes: r.notes });
  for (const r of fun.data || []) add(r.location, { sort: t24(r.time_start || '16:00'), color: KINDS.fundraiser.color, label: 'Tuesday Fundraiser', page: KINDS.fundraiser.page,
    title: r.organization || r.name, time: [time12(r.time_start), time12(r.time_finish)].filter(Boolean).join(' – ') || '4:00 PM – Close',
    lines: [['What to do', 'Guests mention the organization when they order; ring their dine-in and takeout food sales for the 20% donation.'], ...contact(r)], notes: r.notes });
  for (const r of lr.data || []) add(r.location, { sort: t24(r.time_start), color: KINDS.large_reservation.color, label: 'Large Reservation', page: KINDS.large_reservation.page,
    title: r.organization || r.name, time: [time12(r.time_start), time12(r.time_finish)].filter(Boolean).join(' – '),
    lines: [['Guests', r.guest_count], ['Event', r.event_type], ['Private room', r.requires_room ? 'Yes' : ''], ['Order', r.order_preference], ...contact(r)], notes: r.notes });
  for (const r of kc.data || []) add(r.location, { sort: t24(r.time_start), color: KINDS.kids_class.color, label: 'Kids Pizza Class', page: KINDS.kids_class.page,
    title: r.organization || r.name, time: [time12(r.time_start), time12(r.time_finish)].filter(Boolean).join(' – '),
    lines: [['Kids', r.guest_count], ['Event', r.event_type], ['Private room', r.requires_room ? 'Yes' : ''], ...contact(r)], notes: r.notes });
  for (const r of se.data || []) if (!/cancel/i.test(r.status || '')) add(r.location, { sort: '99:98', color: '#7c3aed', label: 'Store Event', page: 'store-events',
    title: r.organization || r.name, lines: [['Status', r.status], ...contact(r)], notes: r.notes });
  for (const r of ent.data || []) { const t = entertainmentOn(r, day); if (t) add(r.location_id, { sort: '98:00', color: '#0891b2', label: 'Entertainment', title: r.title, time: t, lines: [], notes: r.details }); }
  const globals: any[] = [];
  for (const r of mk.data || []) {
    if (!r.target_date) continue;
    const start = String(r.target_date).slice(0, 10), end = r.end_date ? String(r.end_date).slice(0, 10) : start;
    const extra = (Array.isArray(r.event_dates) ? r.event_dates : []).map((d: string) => String(d).slice(0, 10));
    if (!((day >= start && day <= end) || extra.includes(day))) continue;
    if (r.location_id) add(r.location_id, { sort: '99:99', color: '#ea580c', label: 'Store Promotion', title: r.title, lines: [], notes: r.description });
    else globals.push(r);
  }

  const results: any[] = [];
  for (const [loc, items] of Object.entries(byStore)) {
    if (onlyStore && loc !== onlyStore) continue;
    const store = STORES[loc];
    items.sort((a, b) => a.sort.localeCompare(b.sort));
    const lines = (ls: [string, unknown][]) => ls.filter(([, v]) => v || v === 0).map(([k, v]) =>
      `<tr><td style="padding:2px 10px 2px 0;color:#6b7280;white-space:nowrap;vertical-align:top">${esc(k)}</td><td style="padding:2px 0">${esc(v)}</td></tr>`).join('');
    const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#111827;line-height:1.5">
      <div style="text-align:center;margin-bottom:16px"><img src="${APP_URL}/square-peg-logo.png" alt="Square Peg Pizzeria" style="max-height:70px" /></div>
      <h2 style="margin:0 0 4px">Today at ${esc(store.name)}</h2>
      <div style="color:#6b7280;margin:0 0 16px">${esc(longDate(day))} · ${items.length} event${items.length === 1 ? '' : 's'}</div>
      ${items.map((it) => `<div style="border:1px solid #e5e7eb;border-left:5px solid ${it.color};border-radius:8px;padding:12px 14px;margin:0 0 12px">
        <div style="font-size:12px;font-weight:bold;color:${it.color};text-transform:uppercase;letter-spacing:.04em">${esc(it.label)}</div>
        <div style="font-size:17px;font-weight:bold;margin:2px 0">${esc(it.title)}${it.time ? ` <span style="font-weight:normal;color:#374151">· ${esc(it.time)}</span>` : ''}</div>
        ${it.lines.length ? `<table style="border-collapse:collapse;font-size:14px">${lines(it.lines)}</table>` : ''}
        ${it.notes ? `<div style="margin-top:6px;font-size:14px;border-left:3px solid #ddd;padding:4px 10px;white-space:pre-wrap">${esc(it.notes)}</div>` : ''}
      </div>`).join('')}
      ${globals.length ? `<div style="font-size:14px;color:#374151;margin:4px 0 12px"><b>Also running at all stores:</b> ${globals.map((g) => esc(g.title)).join(', ')}</div>` : ''}
      <p style="margin:16px 0 0"><a href="${APP_URL}/master-calendar" style="background:#1f2937;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;display:inline-block;font-weight:bold">Open the calendar</a></p>
      <p style="font-size:12px;color:#6b7280;margin:14px 0 0">Something wrong or missing? Reply to this email and it goes to the catering team.</p>
    </div>`;
    const subject = `Today at ${store.name}: ${items.map((i) => i.label).filter((v, i, a) => a.indexOf(v) === i).join(', ')} · ${longDate(day)}`;
    const ok = await send([testTo || store.email], REPLY_TO, { subject, html, attachments: [] });
    results.push({ store: store.name, events: items.length, sent: ok });
  }
  return json(200, { ok: true, day, stores: results });
}
