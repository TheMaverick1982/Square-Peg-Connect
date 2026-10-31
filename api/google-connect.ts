// Vercel serverless function: connect / disconnect the catering Gmail inbox (read-only).
// POST { action: "start" }      → signed-in team member gets the Google sign-in link.
// POST { action: "disconnect" } → admins only; forgets the saved Google access.
import { createClient } from '@supabase/supabase-js';
import { createHmac } from 'node:crypto';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tsrnpmkipdbtwyrlfbuy.supabase.co';
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
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
