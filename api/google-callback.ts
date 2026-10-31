// Vercel serverless function: Google sends the user back here after they approve read-only Gmail access.
import { createClient } from '@supabase/supabase-js';
import { createHmac, timingSafeEqual } from 'node:crypto';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tsrnpmkipdbtwyrlfbuy.supabase.co';
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const APP_URL = process.env.APP_URL || 'https://connect.squarepegpizzeria.com';

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
