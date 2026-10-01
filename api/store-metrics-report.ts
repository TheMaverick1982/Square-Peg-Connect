// Vercel serverless function: emails the weekly Store Metrics report (all stores, one email).
// Requires Vercel env vars: SUPABASE_SECRET_KEY and RESEND_API_KEY.
// Optional: REPORT_FROM (default "Square Peg Connect <connect@updates.squarepegpizzeria.com>").
import { createClient } from '@supabase/supabase-js';
// Self-contained on purpose (Vercel functions can't reliably import app files).
// Keep in sync with src/lib/data.ts (locations) and src/lib/storeMetrics.ts (math).
const locations: { id: string; name: string; email?: string }[] = [
  { id: "loc-1", name: "Storrs", email: "storrs@squarepegpizzeria.com" },
  { id: "loc-2", name: "Vernon", email: "vernon@squarepegpizzeria.com" },
  { id: "loc-3", name: "Shelton", email: "shelton@squarepegpizzeria.com" },
  { id: "loc-4", name: "Preston", email: "preston@squarepegpizzeria.com" },
  { id: "loc-5", name: "Glastonbury", email: "glastonbury@squarepegpizzeria.com" },
  { id: "loc-6", name: "East Hartford", email: "ehartford@squarepegpizzeria.com" },
  { id: "loc-7", name: "Plainville", email: "plainville@squarepegpizzeria.com" },
  { id: "loc-8", name: "Delray Beach", email: "delraybeach@squarepegpizzeria.com" },
  { id: "loc-9", name: "Berlin", email: "berlin@squarepegpizzeria.com" },
  { id: "loc-10", name: "Bolton", email: "bolton@squarepegpizzeria.com" },
];


interface WeeklyMetricRow {
  location_id: string;
  week_ending: string; // yyyy-MM-dd
  loyalty_visits: number;
  non_loyalty_visits: number;
  new_loyalty_members: number;
  loyalty_aov: number | null;
  non_loyalty_aov: number | null;
}

interface ComputedWeek extends WeeklyMetricRow {
  total_visits: number;
  /** Loyalty visits ÷ all visits, as a percentage (e.g. 26.4). null if no visits. */
  penetration: number | null;
  /** Starting total + all new members up to and including this week. */
  total_loyalty_members: number;
  /** (Loyalty AOV − Non-loyalty AOV) ÷ Non-loyalty AOV, as a percentage (e.g. 20). */
  aov_premium: number | null;
}

const num = (v: unknown) => (v === null || v === undefined || v === "" ? 0 : Number(v) || 0);
const numOrNull = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v));

function loyaltyPenetration(loyalty: number, nonLoyalty: number): number | null {
  const total = loyalty + nonLoyalty;
  return total > 0 ? (loyalty / total) * 100 : null;
}

function aovPremium(loyaltyAov: number | null, nonLoyaltyAov: number | null): number | null {
  if (loyaltyAov === null || nonLoyaltyAov === null || nonLoyaltyAov <= 0) return null;
  return ((loyaltyAov - nonLoyaltyAov) / nonLoyaltyAov) * 100;
}

/** Computes every week for one store, oldest → newest, with running loyalty totals. */
function computeStoreHistory(rows: WeeklyMetricRow[], startingMembers: number): ComputedWeek[] {
  const sorted = [...rows].sort((a, b) => a.week_ending.localeCompare(b.week_ending));
  let running = num(startingMembers);
  return sorted.map((r) => {
    const loyalty = num(r.loyalty_visits);
    const non = num(r.non_loyalty_visits);
    const newMembers = num(r.new_loyalty_members);
    const lAov = numOrNull(r.loyalty_aov);
    const nAov = numOrNull(r.non_loyalty_aov);
    running += newMembers;
    return {
      ...r,
      loyalty_visits: loyalty,
      non_loyalty_visits: non,
      new_loyalty_members: newMembers,
      loyalty_aov: lAov,
      non_loyalty_aov: nAov,
      total_visits: loyalty + non,
      penetration: loyaltyPenetration(loyalty, non),
      total_loyalty_members: running,
      aov_premium: aovPremium(lAov, nAov),
    };
  });
}

const fmtPct = (v: number | null) => (v === null || !isFinite(v) ? "—" : `${v.toFixed(1).replace(/\.0$/, "")}%`);
const fmtMoney = (v: number | null) =>
  v === null || !isFinite(v) ? "—" : `$${v.toFixed(2).replace(/\.00$/, "")}`;
const fmtInt = (v: number | null) => (v === null || !isFinite(v) ? "—" : Math.round(v).toLocaleString("en-US"));


const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tsrnpmkipdbtwyrlfbuy.supabase.co';
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const REPORT_FROM = process.env.REPORT_FROM || 'Square Peg Connect <connect@updates.squarepegpizzeria.com>';

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

function prettyDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  });
}

// Penetration color bands: under 25% red, 25–49.9% orange, 50%+ green.
function penColor(v: number | null) {
  if (v === null || !isFinite(v)) return '#111827';
  if (v < 25) return '#dc2626';
  if (v < 50) return '#ea580c';
  return '#16a34a';
}
const penHtml = (v: number | null) => `<span style="color:${penColor(v)};font-weight:bold">${fmtPct(v)}</span>`;

function delta(cur: number | null, prev: number | null | undefined, kind: 'pts' | 'int' | 'money') {
  if (cur === null || prev === null || prev === undefined) return '';
  const d = cur - prev;
  if (Math.abs(d) < 0.05) return `<span style="color:#6b7280;font-size:12px"> (no change vs last week)</span>`;
  const sign = d > 0 ? '▲ +' : '▼ −';
  const abs = Math.abs(d);
  const txt = kind === 'pts' ? `${abs.toFixed(1)} pts` : kind === 'money' ? `$${abs.toFixed(2)}` : Math.round(abs).toLocaleString('en-US');
  return `<span style="color:#6b7280;font-size:12px"> (${sign}${txt} vs last week)</span>`;
}

const line = (label: string, value: string, extra = '') =>
  `<tr><td style="padding:2px 0;color:#374151">${label}:</td><td style="padding:2px 0 2px 8px;font-weight:bold;color:#111827">${value}${extra}</td></tr>`;

function storeSection(name: string, manager: string, cur: ComputedWeek | undefined, prev: ComputedWeek | undefined) {
  const head = `<h3 style="margin:0 0 4px;font-size:17px;color:#111827">Store Location: ${esc(name)}</h3>
    <div style="margin:0 0 12px;color:#374151;font-size:14px">Manager Name: <b>${esc(manager)}</b></div>`;
  if (!cur) {
    return `<div style="border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:0 0 16px">${head}
      <div style="color:#b45309;font-size:14px">No numbers entered for this week.</div></div>`;
  }
  return `<div style="border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:0 0 16px">${head}
    <div style="font-weight:bold;margin:8px 0 4px;color:#111827">Store Visits</div>
    <table style="font-size:14px;border-collapse:collapse">
      ${line('Loyalty Members', fmtInt(cur.loyalty_visits), delta(cur.loyalty_visits, prev?.loyalty_visits, 'int'))}
      ${line('Non-Loyalty visits', fmtInt(cur.non_loyalty_visits), delta(cur.non_loyalty_visits, prev?.non_loyalty_visits, 'int'))}
      ${line('Total Visits', fmtInt(cur.total_visits), delta(cur.total_visits, prev?.total_visits, 'int'))}
      ${line('Loyalty Penetration', penHtml(cur.penetration), delta(cur.penetration, prev?.penetration, 'pts'))}
    </table>
    <table style="font-size:14px;border-collapse:collapse;margin-top:8px">
      ${line('New Loyalty Members Joined Loyalty', fmtInt(cur.new_loyalty_members))}
      ${line('Total Loyalty Members', fmtInt(cur.total_loyalty_members))}
    </table>
    <div style="font-weight:bold;margin:12px 0 4px;color:#111827">Average Order Value</div>
    <table style="font-size:14px;border-collapse:collapse">
      ${line('Loyalty Average Order Value', fmtMoney(cur.loyalty_aov), delta(cur.loyalty_aov, prev?.loyalty_aov, 'money'))}
      ${line('Non-Loyalty Order Value', fmtMoney(cur.non_loyalty_aov), delta(cur.non_loyalty_aov, prev?.non_loyalty_aov, 'money'))}
      ${line('Loyalty AOV Premium %', fmtPct(cur.aov_premium), delta(cur.aov_premium, prev?.aov_premium, 'pts'))}
    </table></div>`;
}

// Quick side-by-side of every store for the week (stores without numbers show dashes).
function compareTable(stores: { loc: { name: string }; cur?: ComputedWeek; prev?: ComputedWeek }[]) {
  const th = (t: string, align = 'right') =>
    `<th style="padding:6px 4px;text-align:${align};font-size:11px;color:#6b7280;font-weight:bold;text-transform:uppercase;border-bottom:2px solid #e5e7eb">${t}</th>`;
  const td = (v: string, align = 'right', bold = false) =>
    `<td style="padding:6px 4px;text-align:${align};font-size:13px;white-space:nowrap;border-bottom:1px solid #f3f4f6;${bold ? 'font-weight:bold;' : ''}color:${v === '—' ? '#9ca3af' : '#111827'}">${v}</td>`;
  const arrow = (cur: number | null, prev: number | null | undefined) =>
    cur === null || prev === null || prev === undefined || Math.abs(cur - prev) < 0.05 ? '' : cur > prev ? ' <span style="color:#6b7280">▲</span>' : ' <span style="color:#6b7280">▼</span>';
  const rowsHtml = stores.map(({ loc, cur, prev }) => cur
    ? `<tr>${td(esc(loc.name), 'left', true)}${td(fmtInt(cur.total_visits))}${td(penHtml(cur.penetration) + arrow(cur.penetration, prev?.penetration))}${td(fmtInt(cur.new_loyalty_members))}${td(fmtInt(cur.total_loyalty_members))}${td(fmtPct(cur.aov_premium) + arrow(cur.aov_premium, prev?.aov_premium))}</tr>`
    : `<tr>${td(esc(loc.name), 'left', true)}${td('—')}${td('—')}${td('—')}${td('—')}${td('—')}</tr>`
  ).join('');
  return `<table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;margin:0 0 24px">
    <tr>${th('Store', 'left')}${th('Total visits')}${th('Penetration')}${th('New members')}${th('Total members')}${th('AOV premium')}</tr>
    ${rowsHtml}
  </table>
  <div style="font-size:11px;color:#6b7280;margin:-16px 0 24px">Penetration = loyalty visits ÷ total visits. <span style="color:#dc2626;font-weight:bold">Under 25%</span> · <span style="color:#ea580c;font-weight:bold">25–49.9%</span> · <span style="color:#16a34a;font-weight:bold">50%+</span></div>`;
}

export async function POST(request: Request): Promise<Response> {
  if (!SECRET_KEY) return json(500, { error: 'Server is missing SUPABASE_SECRET_KEY.' });
  if (!RESEND_API_KEY) return json(500, { error: 'Server is missing RESEND_API_KEY. Add it in Vercel → Settings → Environment Variables, then redeploy.' });

  const admin = createClient(SUPABASE_URL, SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

  // Admins only.
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return json(401, { error: 'Not signed in.' });
  const { data: caller } = await admin.auth.getUser(token);
  const callerEmail = caller?.user?.email?.toLowerCase();
  if (!callerEmail) return json(401, { error: 'Session expired. Sign in again.' });
  const { data: callerProfile } = await admin.from('employee_profiles').select('role,status').ilike('email', callerEmail).maybeSingle();
  if (!callerProfile || callerProfile.role !== 'admin' || callerProfile.status === 'disabled') {
    return json(403, { error: 'Only admins can send this report.' });
  }

  let body: { week_ending?: string };
  try { body = await request.json(); } catch { return json(400, { error: 'Bad request.' }); }
  const week = String(body.week_ending || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(week)) return json(400, { error: 'Pick a week first.' });

  const [{ data: rows, error: rowsErr }, { data: baselines }, { data: settings }, { data: profiles }] = await Promise.all([
    admin.from('store_metrics_weekly').select('*').lte('week_ending', week),
    admin.from('store_metrics_baseline').select('*'),
    admin.from('store_metrics_settings').select('recipients').eq('id', 1).maybeSingle(),
    admin.from('employee_profiles').select('name,email,role,assigned_locations,assigned_location,status'),
  ]);
  if (rowsErr) return json(500, { error: rowsErr.message });

  const recipients = ((settings?.recipients as string[] | undefined) || []).map((e) => e.trim()).filter((e) => /@/.test(e));
  if (!recipients.length) return json(400, { error: 'Add at least one report recipient first.' });

  const managerFor = (locId: string, locEmail?: string) => {
    const ps = (profiles || []).filter((p) => p.status !== 'disabled');
    const byStoreEmail = locEmail && ps.find((p) => (p.email || '').toLowerCase() === locEmail.toLowerCase());
    if (byStoreEmail && byStoreEmail.name && !/@/.test(byStoreEmail.name)) return byStoreEmail.name;
    const assigned = ps.filter((p) => p.role === 'manager' &&
      ((Array.isArray(p.assigned_locations) && p.assigned_locations.includes(locId)) || p.assigned_location === locId));
    if (assigned.length) return assigned.map((p) => p.name || p.email).join(', ');
    return byStoreEmail ? (byStoreEmail.name || byStoreEmail.email) : '—';
  };

  let allLoyalty = 0, allNon = 0, allNew = 0, storesReported = 0;
  const perStore = locations.map((loc) => {
    const storeRows = ((rows || []) as WeeklyMetricRow[]).filter((r) => r.location_id === loc.id);
    const start = (baselines || []).find((b) => b.location_id === loc.id)?.starting_loyalty_members ?? 0;
    const hist = computeStoreHistory(storeRows, start);
    const idx = hist.findIndex((h) => h.week_ending === week);
    const cur = idx >= 0 ? hist[idx] : undefined;
    const prev = idx > 0 ? hist[idx - 1] : undefined;
    if (cur) { storesReported++; allLoyalty += cur.loyalty_visits; allNon += cur.non_loyalty_visits; allNew += cur.new_loyalty_members; }
    return { loc, cur, prev };
  });
  const sections = perStore.map(({ loc, cur, prev }) => storeSection(loc.name, managerFor(loc.id, loc.email), cur, prev));
  const summaryTable = compareTable(perStore);

  if (!storesReported) return json(400, { error: 'No numbers are saved for that week yet.' });

  const allPen = allLoyalty + allNon > 0 ? (allLoyalty / (allLoyalty + allNon)) * 100 : null;
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#111827">
    <h2 style="margin:0 0 4px">Previous 7 Days Report</h2>
    <div style="color:#6b7280;margin:0 0 16px">Week ending ${prettyDate(week)}</div>
    <div style="background:#f3f4f6;border-radius:8px;padding:12px 16px;margin:0 0 20px;font-size:14px">
      <b>All stores:</b> ${penHtml(allPen)} loyalty penetration · ${fmtInt(allLoyalty + allNon)} total visits · ${fmtInt(allNew)} new loyalty members · ${storesReported} of ${locations.length} stores reported
    </div>
    ${summaryTable}
    ${sections.join('\n')}
    <div style="color:#9ca3af;font-size:12px;margin-top:16px">Sent from Square Peg Connect · connect.squarepegpizzeria.com/store-metrics</div>
  </div>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: REPORT_FROM,
      to: recipients,
      subject: `Store Metrics — week ending ${prettyDate(week)}`,
      html,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.error('Resend error', res.status, detail);
    return json(502, { error: `Email service error (${res.status}). ${detail.slice(0, 200)}` });
  }
  return json(200, { ok: true, sent_to: recipients.length, stores: storesReported });
}
