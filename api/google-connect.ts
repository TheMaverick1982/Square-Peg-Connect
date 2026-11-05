// Vercel serverless function: connect / disconnect the catering Gmail inbox (read-only), and Google's sign-in return (GET).
// POST { action: "start" }      → signed-in team member gets the Google sign-in link.
// POST { action: "disconnect" } → admins only; forgets the saved Google access.
import { createClient } from '@supabase/supabase-js';
import { createHmac, timingSafeEqual } from 'node:crypto';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tsrnpmkipdbtwyrlfbuy.supabase.co';
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const APP_URL = process.env.APP_URL || 'https://connect.squarepegpizzeria.com';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

function signState(payload: object) {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', SECRET_KEY).update(data).digest('base64url');
  return `${data}.${sig}`;
}

export async function POST(request: Request): Promise<Response> {
  if (!SECRET_KEY) return json(500, { error: 'Server is not configured.' });
  const admin = createClient(SUPABASE_URL, SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return json(401, { error: 'Not signed in.' });
  const { data: caller } = await admin.auth.getUser(token);
  const me = caller?.user?.email?.toLowerCase();
  if (!me) return json(401, { error: 'Session expired. Sign in again.' });
  const { data: profiles } = await admin.from('employee_profiles').select('email,role,status');
  const profile = (profiles || []).find((p) => (p.email || '').trim().toLowerCase() === me && p.status !== 'disabled');
  if (!profile) return json(403, { error: 'Not on the team list.' });

  let body: { action?: string };
  try { body = await request.json(); } catch { body = {}; }

  if (body.action === 'disconnect') {
    if (profile.role !== 'admin') return json(403, { error: 'Only admins can disconnect the inbox.' });
    await admin.from('mailbox_connections').delete().neq('email', '');
    return json(200, { ok: true });
  }

  if (!GOOGLE_CLIENT_ID) return json(500, { error: 'Google sign-in is not set up yet (GOOGLE_CLIENT_ID missing in Vercel).' });
  const state = signState({ by: me, exp: Date.now() + 15 * 60 * 1000 });
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: `${APP_URL}/api/google-callback`,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/gmail.readonly email',
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  });
  return json(200, { url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
}

const back = (result: string) => Response.redirect(`${APP_URL}/settings?tab=inbox&inbox=${encodeURIComponent(result)}`, 302);

function readState(state: string): { by: string; exp: number } | null {
  const [data, sig] = state.split('.');
  if (!data || !sig) return null;
  const expected = createHmac('sha256', SECRET_KEY).update(data).digest('base64url');
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(data, 'base64url').toString());
    return p && p.exp > Date.now() ? p : null;
  } catch { return null; }
}

// Google sends the user back here (/api/google-callback is rewritten to this file in vercel.json).
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  if (url.searchParams.get('error')) return back('cancelled');
  const code = url.searchParams.get('code') || '';
  const state = readState(url.searchParams.get('state') || '');
  if (!code || !state) return back('expired');
  if (!SECRET_KEY || !GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) return back('not-configured');

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code, client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: `${APP_URL}/api/google-callback`, grant_type: 'authorization_code',
    }),
  });
  const tokens = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok || !tokens.access_token) return back('failed');
  if (!tokens.refresh_token) return back('no-refresh');

  // Which inbox did they connect?
  const prof = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', { headers: { authorization: `Bearer ${tokens.access_token}` } });
  const profile = await prof.json().catch(() => ({}));
  const email = String(profile.emailAddress || '').toLowerCase();
  if (!email) return back('failed');

  const admin = createClient(SUPABASE_URL, SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  // One connected inbox at a time.
  await admin.from('mailbox_connections').delete().neq('email', email);
  const { error } = await admin.from('mailbox_connections').upsert({
    email, refresh_token: tokens.refresh_token, connected_by: state.by, connected_at: new Date().toISOString(), last_error: null,
  }, { onConflict: 'email' });
  return back(error ? 'failed' : 'connected');
}
