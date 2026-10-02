// Vercel serverless function: Monday marketing digest.
// GET  (Vercel Cron, Mondays): emails each assignee their overdue tasks and tasks due in the next 7 days.
// POST (signed-in team member): sends that same digest to just the caller, for a preview.
// Guard rails: runs at most once every 20 hours via cron, and if CRON_SECRET is set in Vercel the cron call must carry it.
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tsrnpmkipdbtwyrlfbuy.supabase.co';
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const FROM = process.env.REPORT_FROM || 'Square Peg Connect <connect@updates.squarepegpizzeria.com>';
const APP_URL = 'https://connect.squarepegpizzeria.com';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const isEmail = (e: unknown): e is string => typeof e === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const pretty = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
};

type Task = { id: string; title: string; assigned_to: string | null; due_date: string | null; is_completed: boolean; campaign_id: string };

async function buildDigests(admin: any) {
  const today = ymd(new Date());
  const weekOut = ymd(new Date(Date.now() + 7 * 86400000));
  const [{ data: tasks, error }, { data: campaigns }] = await Promise.all([
    admin.from('marketing_tasks').select('*').eq('is_completed', false),
    admin.from('marketing_campaigns').select('*'),
  ]);
  if (error) throw error;
  const campById = new Map<string, any>((campaigns || []).map((c: any) => [c.id, c]));
  const byPerson = new Map<string, { overdue: Task[]; soon: Task[] }>();
  for (const t of (tasks || []) as Task[]) {
    const camp = campById.get(t.campaign_id);
    if (!camp || camp.archived_at || !t.due_date || !isEmail(t.assigned_to)) continue;
    const who = t.assigned_to.trim().toLowerCase();
    const bucket = byPerson.get(who) || { overdue: [], soon: [] };
    if (t.due_date < today) bucket.overdue.push(t);
    else if (t.due_date <= weekOut) bucket.soon.push(t);
    else continue;
    byPerson.set(who, bucket);
  }
  const render = (who: string, b: { overdue: Task[]; soon: Task[] }) => {
    const row = (t: Task, late: boolean) => {
      const camp = campById.get(t.campaign_id);
      const due = late
        ? `<span style="background:#dc2626;color:#fff;border-radius:4px;padding:1px 6px;font-weight:bold;font-size:12px">Overdue · ${esc(pretty(t.due_date!))}</span>`
        : `<span style="color:#6b7280;font-size:13px">Due ${esc(pretty(t.due_date!))}</span>`;
      return `<tr><td style="padding:8px 0;border-bottom:1px solid #f3f4f6"><div style="font-weight:bold;font-size:14px">${esc(t.title)}</div>
        <div style="color:#6b7280;font-size:13px">${esc(camp?.title || '')}${camp?.target_date ? ` · event ${esc(pretty(camp.target_date))}` : ''}</div></td>
        <td style="padding:8px 0 8px 12px;border-bottom:1px solid #f3f4f6;text-align:right;white-space:nowrap">${due}</td></tr>`;
    };
    const sort = (a: Task, b2: Task) => (a.due_date || '').localeCompare(b2.due_date || '');
    const section = (title: string, list: Task[], late: boolean) => list.length
      ? `<h3 style="margin:18px 0 4px;font-size:15px">${title} (${list.length})</h3><table style="width:100%;border-collapse:collapse">${list.sort(sort).map((t) => row(t, late)).join('')}</table>` : '';
    return {
      to: who,
      subject: `Your marketing tasks this week${b.overdue.length ? ` (${b.overdue.length} overdue)` : ''}`,
      html: `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111827">
        <h2 style="margin:0 0 4px">Your marketing tasks this week</h2>
        <div style="color:#6b7280;margin:0 0 6px">${b.overdue.length} overdue · ${b.soon.length} due in the next 7 days</div>
        ${section('Overdue', b.overdue, true)}${section('Due this week', b.soon, false)}
        <p style="margin:20px 0 0"><a href="${APP_URL}/campaigns" style="background:#1f2937;color:#ffffff;padding:10px 18px;border-radius:6px;text-decoration:none;display:inline-block;font-weight:bold">Open Marketing Planner</a></p>
        <p style="color:#9ca3af;font-size:12px;margin:18px 0 0">Sent every Monday from Square Peg Connect.</p>
      </div>`,
    };
  };
  return { byPerson, render };
}

async function send(msg: { to: string; subject: string; html: string }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [msg.to], subject: msg.subject, html: msg.html }),
  });
  if (!res.ok) console.error('Resend error', res.status, await res.text().catch(() => ''));
  return res.ok;
}

// Weekly run (Vercel Cron).
export async function GET(request: Request): Promise<Response> {
  if (!SECRET_KEY || !RESEND_API_KEY) return json(500, { error: 'Not configured.' });
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) return json(401, { error: 'Unauthorized.' });

  const admin = createClient(SUPABASE_URL, SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  // At most one run every 20 hours, so the link can't be used to spam the team.
  const { data: state } = await admin.from('notification_settings').select('updated_at').eq('key', 'marketing_digest_last_run').maybeSingle();
  if (state?.updated_at && Date.now() - new Date(state.updated_at).getTime() < 20 * 3600 * 1000) {
    return json(200, { ok: true, skipped: 'already ran recently' });
  }
  await admin.from('notification_settings').upsert({ key: 'marketing_digest_last_run', recipients: [], updated_at: new Date().toISOString() });

  const { byPerson, render } = await buildDigests(admin);
  let sent = 0;
  for (const [who, bucket] of byPerson) if (await send(render(who, bucket))) sent++;
  return json(200, { ok: true, sent });
}

// "Email me my digest" button.
export async function POST(request: Request): Promise<Response> {
  if (!SECRET_KEY || !RESEND_API_KEY) return json(500, { error: 'Email is not configured on the server.' });
  const admin = createClient(SUPABASE_URL, SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const { data: caller } = await admin.auth.getUser(token);
  const me = caller?.user?.email?.toLowerCase();
  if (!me) return json(401, { error: 'Session expired. Sign in again.' });
  const { byPerson, render } = await buildDigests(admin);
  const bucket = byPerson.get(me);
  if (!bucket) return json(200, { ok: true, empty: true });
  const ok = await send(render(me, bucket));
  return ok ? json(200, { ok: true, sent: 1 }) : json(502, { error: 'Email service error.' });
}
