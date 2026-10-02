// Vercel serverless function: Marketing Planner emails (task assigned, social approvals, creative requests).
// Replaces the old Vendasta-era Supabase functions. Signed-in team members only.
// Requires Vercel env vars SUPABASE_SECRET_KEY and RESEND_API_KEY.
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
const prettyDate = (iso?: string | null) => {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return '';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
};

function layout(title: string, rows: [string, string][], bodyHtml: string, cta: string) {
  const table = rows.filter(([, v]) => v).map(([k, v]) =>
    `<tr><td style="padding:3px 14px 3px 0;color:#6b7280;vertical-align:top;white-space:nowrap">${esc(k)}</td><td style="padding:3px 0;font-weight:bold">${v}</td></tr>`).join('');
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111827">
    <h2 style="margin:0 0 14px">${esc(title)}</h2>
    <table style="font-size:14px;border-collapse:collapse;margin:0 0 14px">${table}</table>
    ${bodyHtml}
    <p style="margin:18px 0 0"><a href="${APP_URL}/campaigns" style="background:#1f2937;color:#ffffff;padding:10px 18px;border-radius:6px;text-decoration:none;display:inline-block;font-weight:bold">${esc(cta)}</a></p>
    <p style="color:#9ca3af;font-size:12px;margin:18px 0 0">Sent from Square Peg Connect · Marketing Planner</p>
  </div>`;
}
const noteBlock = (label: string, text?: string | null) => text
  ? `<div style="font-size:13px;color:#6b7280;margin:0 0 4px">${esc(label)}</div><div style="background:#f3f4f6;border-radius:6px;padding:10px 12px;font-size:14px;white-space:pre-wrap">${esc(text)}</div>`
  : '';

export async function POST(request: Request): Promise<Response> {
  if (!SECRET_KEY || !RESEND_API_KEY) return json(500, { error: 'Email is not configured on the server.' });
  const admin = createClient(SUPABASE_URL, SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

  // Signed-in team members only.
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return json(401, { error: 'Not signed in.' });
  const { data: caller } = await admin.auth.getUser(token);
  const callerEmail = caller?.user?.email?.toLowerCase();
  if (!callerEmail) return json(401, { error: 'Session expired. Sign in again.' });
  const { data: profiles } = await admin.from('employee_profiles').select('name,email,status');
  const me = (profiles || []).find((p) => (p.email || '').trim().toLowerCase() === callerEmail && p.status !== 'disabled');
  if (!me) return json(403, { error: 'Not on the team list.' });
  const senderName = me.name && !/@/.test(me.name) ? me.name : callerEmail;

  let body: any;
  try { body = await request.json(); } catch { return json(400, { error: 'Bad request.' }); }

  const setting = async (key: string): Promise<string[]> => {
    const { data } = await admin.from('notification_settings').select('recipients').eq('key', key).maybeSingle();
    return ((data?.recipients as string[] | undefined) || []).filter(isEmail);
  };

  let to: string[] = [];
  let subject = '';
  let html = '';

  if (body.type === 'task_assigned') {
    if (!isEmail(body.to)) return json(400, { error: 'Assignee needs a valid email.' });
    to = [body.to.trim().toLowerCase()];
    subject = `New task: ${body.taskTitle}`;
    html = layout('You have a new marketing task', [
      ['Task', esc(body.taskTitle)],
      ['Campaign', esc(body.campaignTitle)],
      ['Due', esc(prettyDate(body.dueDate))],
      ['Assigned by', esc(senderName)],
    ], '', 'Open Marketing Planner');
  } else if (body.type === 'creative_request') {
    to = isEmail(body.to) ? [body.to.trim().toLowerCase()] : await setting('social_team');
    subject = `Creative request: ${body.campaignTitle}`;
    html = layout('Creative request for a campaign', [
      ['Campaign', esc(body.campaignTitle)],
      ['Event date', esc(prettyDate(body.targetDate))],
      ['Creative due', esc(prettyDate(body.dueDate))],
      ['Requested by', esc(senderName)],
    ], noteBlock('Guidance', body.notes), 'Open Creative Requests');
  } else if (body.type === 'social_post') {
    const post = body.post || {};
    const action = String(body.action || '');
    const forApprovers = action === 'requested' || action === 'needs_approval';
    to = forApprovers ? await setting('social_approvals') : (isEmail(post.assigned_to) ? [post.assigned_to.trim().toLowerCase()] : await setting('social_team'));
    const titles: Record<string, string> = {
      requested: 'Social post ready for approval', needs_approval: 'Social post ready for approval',
      approved: 'Your social post was approved', changes_needed: 'Changes requested on your social post',
    };
    if (!titles[action]) return json(400, { error: 'Unknown social action.' });
    subject = `${titles[action]}: ${post.title || ''}`.trim();
    const media = post.media_url && /^https:\/\//.test(post.media_url)
      ? `<p style="margin:12px 0 0"><a href="${esc(post.media_url)}">View the creative</a></p>` : '';
    html = layout(titles[action], [
      ['Post', esc(post.title)],
      ['Platform', esc([post.platform, post.format].filter(Boolean).join(' · '))],
      ['Go-live date', esc(prettyDate(post.target_date))],
      [forApprovers ? 'Submitted by' : 'Reviewed by', esc(senderName)],
    ], noteBlock('Caption / copy', post.content) + (action === 'changes_needed' ? '<div style="height:10px"></div>' + noteBlock('Feedback', body.feedback || post.feedback_notes) : '') + media, 'Open Social Approvals');
  } else {
    return json(400, { error: 'Unknown notification type.' });
  }

  to = Array.from(new Set(to));
  if (!to.length) return json(200, { ok: true, skipped: 'no recipients configured' });

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: FROM, to, reply_to: callerEmail, subject, html }),
  });
  if (!res.ok) {
    console.error('Resend error', res.status, await res.text().catch(() => ''));
    return json(502, { error: 'Email service error.' });
  }
  return json(200, { ok: true, sent_to: to.length });
}
