// Vercel serverless function: Weekly Leads & Events Report (catering, fundraisers, large reservations, kids pizza classes).
// GET  (Vercel Cron, Monday mornings): each store gets its own report; extra recipients (notification_settings
//      key "leads_report") get the all-stores report. Covers last Monday–Sunday (store time) vs the week before.
// POST (signed-in admin): { mode: "test" } emails the all-stores report to the caller only, marked [TEST];
//      { mode: "send" } runs the full send now.
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tsrnpmkipdbtwyrlfbuy.supabase.co';
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const FROM = process.env.REPORT_FROM || 'Square Peg Connect <connect@updates.squarepegpizzeria.com>';
const APP_URL = 'https://connect.squarepegpizzeria.com';
const TZ = 'America/New_York';

// Keep in sync with src/lib/data.ts
const STORES: { id: string; name: string; email: string }[] = [
  { id: 'loc-1', name: 'Storrs', email: 'storrs@squarepegpizzeria.com' },
  { id: 'loc-2', name: 'Vernon', email: 'vernon@squarepegpizzeria.com' },
  { id: 'loc-3', name: 'Shelton', email: 'shelton@squarepegpizzeria.com' },
  { id: 'loc-4', name: 'Preston', email: 'preston@squarepegpizzeria.com' },
  { id: 'loc-5', name: 'Glastonbury', email: 'glastonbury@squarepegpizzeria.com' },
  { id: 'loc-6', name: 'East Hartford', email: 'ehartford@squarepegpizzeria.com' },
  { id: 'loc-7', name: 'Plainville', email: 'plainville@squarepegpizzeria.com' },
  { id: 'loc-8', name: 'Delray Beach', email: 'delraybeach@squarepegpizzeria.com' },
  { id: 'loc-9', name: 'Berlin', email: 'berlin@squarepegpizzeria.com' },
  { id: 'loc-10', name: 'Bolton', email: 'bolton@squarepegpizzeria.com' },
];
const storeName = (id?: string | null) => STORES.find((s) => s.id === id)?.name || (id ? String(id) : 'No store');

type Kind = 'catering' | 'fundraisers' | 'large' | 'kids';
const KINDS: { key: Kind; table: string; label: string; softDelete: boolean }[] = [
  { key: 'catering', table: 'catering_requests', label: 'Catering', softDelete: false },
  { key: 'fundraisers', table: 'fundraisers', label: 'Tuesday Fundraisers', softDelete: true },
  { key: 'large', table: 'large_reservations', label: 'Large Reservations', softDelete: true },
  { key: 'kids', table: 'kids_classes', label: 'Kids Pizza Classes', softDelete: true },
];

type Lead = { kind: Kind; store: string; created: string; who: string; eventDate: string; source: string; said: string; status: string };
type Sale = { kind: Kind; store: string; amount: number; who: string; eventDate: string };
// Other things happening that week (no leads/revenue): marketing campaigns and entertainment. store '' = all stores.
type Happening = { kind: 'marketing' | 'entertainment'; store: string; who: string; eventDate: string; endDate?: string };

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const isEmail = (e: unknown): e is string => typeof e === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());
const money = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

// Dates (store time)
const nyYmd = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const addDays = (ymd: string, n: number) => { const [y, m, d] = ymd.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
const short = (ymd: string) => { const [y, m, d] = ymd.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }); };
function weeks(now = new Date()) {
  const today = nyYmd(now);
  const [y, m, d] = today.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 Sun … 6 Sat
  const thisMonday = addDays(today, -((dow + 6) % 7));
  const start = addDays(thisMonday, -7), end = addDays(thisMonday, -1);
  return { start, end, prevStart: addDays(start, -7), prevEnd: addDays(start, -1) };
}

function whoOf(kind: Kind, r: any) {
  if (kind === 'catering') return r.company ? `${r.company} (${r.name || ''})` : r.name || '';
  if (kind === 'fundraisers') return r.organization ? `${r.organization} (${r.name || ''})` : r.name || '';
  return r.organization ? `${r.name || ''} · ${r.organization}` : r.name || '';
}
function revenueOf(kind: Kind, r: any) {
  if (kind === 'catering') return ['Confirmed', 'Completed'].includes(r.status) ? Number(r.quote_total) || 0 : 0;
  if (r.status === 'Cancelled') return 0;
  return Number(r.total_sales) || 0;
}

async function loadData(admin: any, w: ReturnType<typeof weeks>) {
  // A little slack on created_at so store-time days near midnight are covered; exact filtering happens below.
  const fromTs = new Date(`${addDays(w.prevStart, -1)}T00:00:00Z`).toISOString();
  const toTs = new Date(`${addDays(w.end, 2)}T00:00:00Z`).toISOString();
  const leads: Lead[] = [], prevLeads: Lead[] = [], sales: Sale[] = [];
  for (const k of KINDS) {
    let q1 = admin.from(k.table).select('*').gte('created_at', fromTs).lt('created_at', toTs);
    let q2 = admin.from(k.table).select('*').gte('event_date', w.start).lte('event_date', w.end);
    if (k.softDelete) { q1 = q1.is('deleted_at', null); q2 = q2.is('deleted_at', null); }
    const [{ data: created, error: e1 }, { data: held, error: e2 }] = await Promise.all([q1, q2]);
    if (e1 || e2) throw new Error(`${k.label}: ${(e1 || e2).message}`);
    for (const r of created || []) {
      const day = nyYmd(new Date(r.created_at));
      const lead: Lead = {
        kind: k.key, store: r.location || '', created: day, who: whoOf(k.key, r), eventDate: r.event_date || '',
        source: r.lead_source || '', said: r.heard_about_us || '', status: r.status || '',
      };
      if (day >= w.start && day <= w.end) leads.push(lead);
      else if (day >= w.prevStart && day <= w.prevEnd) prevLeads.push(lead);
    }
    for (const r of held || []) {
      if (r.status === 'Cancelled') continue;
      sales.push({ kind: k.key, store: r.location || '', amount: revenueOf(k.key, r), who: whoOf(k.key, r), eventDate: String(r.event_date || '').slice(0, 10) });
    }
  }

  // Marketing campaigns running that week (start–end range or any extra dates).
  const happenings: Happening[] = [];
  const { data: camps } = await admin.from('marketing_campaigns').select('*');
  for (const c of camps || []) {
    if (!c.target_date) continue;
    const startD = String(c.target_date).slice(0, 10);
    const endD = c.end_date && c.end_date > startD ? String(c.end_date).slice(0, 10) : startD;
    const extra = (Array.isArray(c.event_dates) ? c.event_dates : []).map((d: string) => String(d).slice(0, 10)).filter((d: string) => d >= w.start && d <= w.end);
    const overlaps = startD <= w.end && endD >= w.start;
    if (!overlaps && !extra.length) continue;
    const first = overlaps ? (startD < w.start ? w.start : startD) : extra.sort()[0];
    happenings.push({ kind: 'marketing', store: c.location_id || '', who: c.title || 'Campaign', eventDate: first, endDate: overlaps && endD !== startD ? endD : undefined });
  }
  // Entertainment (including weekly/monthly repeats), in store time.
  const { data: ents } = await admin.from('events').select('*');
  for (const e of ents || []) {
    if (!e.start_date) continue;
    const first = nyYmd(new Date(e.start_date));
    const dates: string[] = [];
    const repeating = e.is_recurring && ['weekly', 'monthly'].includes(e.recurrence_pattern);
    const until = repeating ? (e.no_end_date || !e.recurrence_end_date ? w.end : nyYmd(new Date(e.recurrence_end_date))) : first;
    for (let i = 0; i < 600; i++) {
      let d: string;
      if (!repeating) { if (i) break; d = first; }
      else if (e.recurrence_pattern === 'weekly') d = addDays(first, 7 * i);
      else { const [y, m, dd] = first.split('-').map(Number); d = new Date(Date.UTC(y, m - 1 + i, dd)).toISOString().slice(0, 10); }
      if (d > w.end || d > until) break;
      if (d >= w.start) dates.push(d);
    }
    const time = new Date(e.start_date).toLocaleTimeString('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' });
    for (const d of dates) happenings.push({ kind: 'entertainment', store: e.location_id || '', who: `${e.title || 'Entertainment'} · ${time}`, eventDate: d });
  }
  return { leads, prevLeads, sales, happenings };
}

const sourceOf = (l: Lead) => l.source || (l.said ? `Told us: ${l.said}` : 'Unknown');

function render(w: ReturnType<typeof weeks>, data: Awaited<ReturnType<typeof loadData>>, storeId: string | null) {
  const inStore = <T extends { store: string }>(arr: T[]) => (storeId ? arr.filter((x) => x.store === storeId) : arr);
  const leads = inStore(data.leads), prev = inStore(data.prevLeads), sales = inStore(data.sales);
  const happenings = storeId ? data.happenings.filter((h) => !h.store || h.store === storeId) : data.happenings;
  const count = (arr: Lead[], k?: Kind) => arr.filter((l) => !k || l.kind === k).length;
  const heldCount = (k?: Kind) => sales.filter((s) => !k || s.kind === k).length;
  const rev = (k?: Kind, store?: string) => sales.filter((s) => (!k || s.kind === k) && (!store || s.store === store)).reduce((a, s) => a + s.amount, 0);
  const change = (now: number, before: number) => {
    const diff = now - before;
    if (diff === 0) return '<span style="color:#6b7280">—</span>';
    return `<span style="color:${diff > 0 ? '#16a34a' : '#dc2626'};font-weight:bold">${diff > 0 ? '▲' : '▼'} ${Math.abs(diff)}</span>`;
  };
  const th = (t: string, align = 'right') => `<th style="text-align:${align};padding:8px 10px;font-size:12px;color:#374151;border-bottom:2px solid #e5e7eb;white-space:nowrap">${t}</th>`;
  const td = (t: string, align = 'right', bold = false) => `<td style="text-align:${align};padding:8px 10px;font-size:14px;border-bottom:1px solid #f3f4f6;${bold ? 'font-weight:bold;' : ''}">${t}</td>`;

  const weekLabel = `${short(w.start)} – ${short(w.end)}`;
  const title = storeId ? `${storeName(storeId)} · Weekly Leads & Events Report` : 'Weekly Leads & Events Report · All Stores';

  // 1) Summary by type
  const summaryRows = KINDS.map((k) => `<tr>${td(k.label, 'left', true)}${td(String(count(leads, k.key)))}${td(String(count(prev, k.key)))}${td(change(count(leads, k.key), count(prev, k.key)))}${td(String(heldCount(k.key)))}${td(rev(k.key) ? money(rev(k.key)) : '<span style="color:#9ca3af">—</span>')}</tr>`).join('');
  const totalRow = `<tr style="background:#f9fafb">${td('Total', 'left', true)}${td(String(leads.length), 'right', true)}${td(String(prev.length), 'right', true)}${td(change(leads.length, prev.length))}${td(String(heldCount()), 'right', true)}${td(money(rev()), 'right', true)}</tr>`;
  const summary = `<table style="width:100%;border-collapse:collapse;margin:0 0 6px"><tr>${th('', 'left')}${th('Leads in this week')}${th('Last week')}${th('Change')}${th('Events held this week')}${th('Revenue')}</tr>${summaryRows}${totalRow}</table>
    <div style="font-size:11px;color:#6b7280;margin:0 0 24px">Leads = requests submitted that week (by the date they came in). Events held / Revenue = by the event date: catering orders, fundraisers, reservations and classes that happened that week, with the sales entered for them (catering counts confirmed/completed orders).</div>`;

  // 2) By store (all-stores report only)
  let byStore = '';
  if (!storeId) {
    const ids = STORES.map((s) => s.id);
    const extra = Array.from(new Set([...leads, ...prev].map((l) => l.store))).filter((id) => !ids.includes(id));
    const rows = [...ids, ...extra].map((id) => {
      const cur = leads.filter((l) => l.store === id), was = prev.filter((l) => l.store === id);
      const r = rev(undefined, id);
      if (!cur.length && !was.length && !r) return '';
      return `<tr>${td(esc(storeName(id)), 'left', true)}${KINDS.map((k) => td(String(count(cur, k.key)))).join('')}${td(`<b>${cur.length}</b>`)}${td(String(was.length))}${td(change(cur.length, was.length))}${td(r ? money(r) : '<span style="color:#9ca3af">—</span>')}</tr>`;
    }).join('');
    byStore = `<h3 style="font-size:16px;margin:0 0 8px">By store</h3>
      <table style="width:100%;border-collapse:collapse;margin:0 0 24px"><tr>${th('Store', 'left')}${th('Catering')}${th('Fundraisers')}${th('Large res.')}${th('Kids classes')}${th('Total')}${th('Last week')}${th('Change')}${th('Revenue')}</tr>
      ${rows || `<tr>${td('<span style="color:#6b7280">No leads either week.</span>', 'left')}</tr>`}</table>`;
  }

  // 3) Where leads came from
  const bySource = new Map<string, number>();
  for (const l of leads) bySource.set(sourceOf(l), (bySource.get(sourceOf(l)) || 0) + 1);
  const sourceRows = [...bySource.entries()].sort((a, b) => b[1] - a[1]).map(([s, n]) => `<tr>${td(esc(s), 'left')}${td(String(n), 'right', true)}</tr>`).join('');
  const sources = `<h3 style="font-size:16px;margin:0 0 8px">Where this week's leads came from</h3>
    ${sourceRows ? `<table style="width:100%;border-collapse:collapse;margin:0 0 6px"><tr>${th('Source', 'left')}${th('Leads')}</tr>${sourceRows}</table>
    <div style="font-size:11px;color:#6b7280;margin:0 0 24px">Source comes from the link they used (ad, Google, email campaign tag). "Told us" is their answer to "How did you hear about us?" when no link source was recorded.</div>` : '<p style="color:#6b7280;margin:0 0 24px">No leads this week.</p>'}`;

  // 4) Every lead this week, grouped by type with a tally, showing both dates
  const kindLabel = (k: Kind) => KINDS.find((x) => x.key === k)!.label;
  const cols = storeId ? 5 : 6;
  const leadRow = (l: Lead) => `<tr>
      ${td(esc(short(l.created)), 'left')}${td(l.eventDate ? esc(short(String(l.eventDate).slice(0, 10))) : '—', 'left')}${storeId ? '' : td(esc(storeName(l.store)), 'left')}
      ${td(esc(l.who), 'left')}${td(esc(l.status || '—'), 'left')}
      ${td(`${esc(l.source || '—')}${l.said ? `<div style="font-size:12px;color:#6b7280">Told us: ${esc(l.said)}</div>` : ''}`, 'left')}</tr>`;
  const groups = KINDS.map((k) => {
    const list = leads.filter((l) => l.kind === k.key).sort((a, b) => a.created.localeCompare(b.created));
    if (!list.length) return '';
    return `<tr><td colspan="${cols + 1}" style="padding:14px 10px 6px;font-size:14px;font-weight:bold;background:#f3f4f6">${esc(k.label)} · ${list.length} lead${list.length === 1 ? '' : 's'}</td></tr>${list.map(leadRow).join('')}`;
  }).join('');
  const leadList = leads.length ? `<h3 style="font-size:16px;margin:0 0 8px">This week's leads (${leads.length})</h3>
    <table style="width:100%;border-collapse:collapse;margin:0 0 24px"><tr>${th('Came in', 'left')}${th('Event date', 'left')}${storeId ? '' : th('Store', 'left')}${th('Who', 'left')}${th('Status', 'left')}${th('Source', 'left')}</tr>${groups}
    <tr style="background:#f9fafb"><td colspan="${cols + 1}" style="padding:8px 10px;font-size:14px;font-weight:bold">Total: ${leads.length} lead${leads.length === 1 ? '' : 's'}</td></tr></table>` : '';

  // 5) Events held this week (by event date), with sales
  type Row = { date: string; type: string; store: string; who: string; sales: string };
  const rows: Row[] = [
    ...sales.map((x) => ({ date: x.eventDate, type: kindLabel(x.kind), store: storeName(x.store), who: x.who,
      sales: x.amount ? money(x.amount) : '<span style="color:#9ca3af">not entered</span>' })),
    ...happenings.map((h) => ({ date: h.eventDate, type: h.kind === 'marketing' ? 'Marketing' : 'Entertainment', store: h.store ? storeName(h.store) : 'All stores',
      who: h.endDate ? `${h.who} (through ${short(h.endDate)})` : h.who, sales: '<span style="color:#9ca3af">—</span>' })),
  ].sort((x, y) => x.date.localeCompare(y.date) || x.type.localeCompare(y.type));
  const typeCell = (t: string) => t === 'Marketing' ? `<span style="color:#7c3aed;font-weight:bold">${t}</span>` : t === 'Entertainment' ? `<span style="color:#9333ea">${t}</span>` : esc(t);
  const heldRows = rows.map((r) => `<tr>${td(esc(short(r.date)), 'left')}${td(typeCell(r.type), 'left')}${storeId ? '' : td(esc(r.store), 'left')}${td(esc(r.who), 'left')}${td(r.sales)}</tr>`).join('');
  const tally = [`${sales.length} booked event${sales.length === 1 ? '' : 's'}`];
  const mk = happenings.filter((h) => h.kind === 'marketing').length, en = happenings.filter((h) => h.kind === 'entertainment').length;
  if (mk) tally.push(`${mk} marketing`);
  if (en) tally.push(`${en} entertainment`);
  const heldList = rows.length ? `<h3 style="font-size:16px;margin:0 0 8px">Events held this week (${rows.length})</h3>
    <table style="width:100%;border-collapse:collapse;margin:0 0 24px"><tr>${th('Date', 'left')}${th('Type', 'left')}${storeId ? '' : th('Store', 'left')}${th('What / who', 'left')}${th('Sales')}</tr>${heldRows}
    <tr style="background:#f9fafb"><td colspan="${storeId ? 3 : 4}" style="padding:8px 10px;font-size:14px;font-weight:bold">Total: ${tally.join(' · ')}</td>${td(money(rev()), 'right', true)}</tr></table>` : '';

  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:820px;margin:0 auto;padding:24px;color:#111827">
    <div style="font-size:26px;font-weight:bold;margin:0 0 2px">${esc(title)}</div>
    <div style="color:#6b7280;margin:0 0 20px">Week of ${esc(weekLabel)} · compared with ${esc(short(w.prevStart))} – ${esc(short(w.prevEnd))}</div>
    ${summary}${byStore}${sources}${leadList}${heldList}${storeId ? photoReminder(storeId) : ''}
    <p style="margin:8px 0 0"><a href="${APP_URL}" style="background:#1f2937;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;display:inline-block;font-weight:bold">Open Square Peg Connect</a></p>
  </div>`;
  const subject = storeId ? `Weekly Leads & Events Report — ${storeName(storeId)} — ${weekLabel}` : `Weekly Leads & Events Report — All Stores — ${weekLabel}`;
  return { subject, html };
}

// Store reports only: reminder to photograph every event, with that store's upload link + QR code.
function photoReminder(storeId: string) {
  const link = `${APP_URL}/public/photo-upload?store=${encodeURIComponent(storeId)}`;
  const qr = `${APP_URL}/qr/photo-upload-${encodeURIComponent(storeId)}.png`;
  return `<div style="border:2px dashed #f59e0b;background:#fffbeb;border-radius:10px;padding:16px 18px;margin:0 0 24px">
    <table style="width:100%;border-collapse:collapse"><tr>
      <td style="vertical-align:top;padding-right:14px">
        <div style="font-size:16px;font-weight:bold;margin:0 0 6px">📸 Don't forget the pictures!</div>
        <div style="font-size:14px;color:#374151;margin:0 0 10px">Take photos at every event this week, or assign someone to take them, and upload them so we can use them in marketing.</div>
        <a href="${link}" style="background:#f59e0b;color:#111827;padding:9px 16px;border-radius:6px;text-decoration:none;display:inline-block;font-weight:bold;font-size:14px">Upload event photos</a>
        <div style="font-size:12px;color:#6b7280;margin-top:8px;word-break:break-all">${esc(link)}</div>
      </td>
      <td style="width:130px;text-align:center;vertical-align:top">
        <img src="${qr}" alt="QR code to upload photos" width="120" height="120" style="display:block;margin:0 auto;border:1px solid #e5e7eb;border-radius:6px;background:#fff" />
        <div style="font-size:11px;color:#6b7280;margin-top:4px">Scan with your phone</div>
      </td>
    </tr></table>
  </div>`;
}

async function send(to: string[], subject: string, html: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  });
  if (!res.ok) console.error('Resend error', res.status, await res.text().catch(() => ''));
  return res.ok;
}

async function sendAll(admin: any) {
  const w = weeks();
  const data = await loadData(admin, w);
  let sent = 0;
  for (const s of STORES) {
    const { subject, html } = render(w, data, s.id);
    if (await send([s.email], subject, html)) sent++;
  }
  const { data: setting } = await admin.from('notification_settings').select('recipients').eq('key', 'leads_report').maybeSingle();
  const extra = Array.from(new Set(((setting?.recipients as string[] | undefined) || []).filter(isEmail).map((e) => e.trim().toLowerCase())));
  if (extra.length) {
    const { subject, html } = render(w, data, null);
    if (await send(extra, subject, html)) sent += extra.length;
  }
  return sent;
}

// Weekly run (Vercel Cron).
export async function GET(request: Request): Promise<Response> {
  if (!SECRET_KEY || !RESEND_API_KEY) return json(500, { error: 'Not configured.' });
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) return json(401, { error: 'Unauthorized.' });
  const admin = createClient(SUPABASE_URL, SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: state } = await admin.from('notification_settings').select('updated_at').eq('key', 'leads_report_last_run').maybeSingle();
  if (state?.updated_at && Date.now() - new Date(state.updated_at).getTime() < 20 * 3600 * 1000) return json(200, { ok: true, skipped: 'already ran recently' });
  await admin.from('notification_settings').upsert({ key: 'leads_report_last_run', recipients: [], updated_at: new Date().toISOString() });
  try { return json(200, { ok: true, sent: await sendAll(admin) }); }
  catch (e) { return json(500, { error: (e as Error).message }); }
}

// Admin buttons: "Send me a test" / "Send to everyone now".
export async function POST(request: Request): Promise<Response> {
  if (!SECRET_KEY || !RESEND_API_KEY) return json(500, { error: 'Email is not configured on the server.' });
  const admin = createClient(SUPABASE_URL, SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return json(401, { error: 'Not signed in.' });
  const { data: caller } = await admin.auth.getUser(token);
  const me = caller?.user?.email?.toLowerCase();
  if (!me) return json(401, { error: 'Session expired. Sign in again.' });
  const { data: profile } = await admin.from('employee_profiles').select('role,status').ilike('email', me).maybeSingle();
  if (!profile || profile.role !== 'admin' || profile.status === 'disabled') return json(403, { error: 'Only admins can send this report.' });

  let body: { mode?: string; store?: string };
  try { body = await request.json(); } catch { body = {}; }
  try {
    if (body.mode === 'send') return json(200, { ok: true, sent: await sendAll(admin) });
    const w = weeks();
    const data = await loadData(admin, w);
    const storeId = body.store && STORES.some((s) => s.id === body.store) ? body.store : null;
    const { subject, html } = render(w, data, storeId);
    const ok = await send([me], `[TEST] ${subject}`, html);
    return ok ? json(200, { ok: true, sent: 1 }) : json(502, { error: 'Email service error.' });
  } catch (e) { return json(500, { error: (e as Error).message }); }
}
