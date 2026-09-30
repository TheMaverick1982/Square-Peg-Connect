// Vercel serverless function: lets Square Peg Connect admins add team members
// and email them a link to set their password (Settings → Team).
// Requires the Vercel env var SUPABASE_SECRET_KEY (Supabase → Project Settings → API Keys → secret key).
// That key must NEVER be exposed to the browser — it only lives here, on the server.
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tsrnpmkipdbtwyrlfbuy.supabase.co';
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const ROLES = ['admin', 'manager', 'employee'] as const;
type Role = (typeof ROLES)[number];

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

export async function POST(request: Request): Promise<Response> {
  if (!SECRET_KEY) return json(500, { error: 'Server is missing SUPABASE_SECRET_KEY. Add it in Vercel → Settings → Environment Variables.' });

  const admin = createClient(SUPABASE_URL, SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1. Who is calling? Must be a signed-in, approved admin.
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return json(401, { error: 'Not signed in.' });
  const { data: caller, error: callerErr } = await admin.auth.getUser(token);
  const callerEmail = caller?.user?.email?.toLowerCase();
  if (callerErr || !callerEmail) return json(401, { error: 'Session expired. Sign in again.' });

  const { data: callerProfile } = await admin
    .from('employee_profiles').select('role,status').ilike('email', callerEmail).maybeSingle();
  if (!callerProfile || callerProfile.role !== 'admin' || callerProfile.status === 'disabled') {
    return json(403, { error: 'Only admins can manage team logins.' });
  }

  // 2. What do they want?
  let body: { action?: string; email?: string; name?: string; role?: string; locations?: string[]; redirectTo?: string };
  try { body = await request.json(); } catch { return json(400, { error: 'Bad request.' }); }

  const email = (body.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json(400, { error: 'Enter a valid email.' });
  const redirectTo = typeof body.redirectTo === 'string' && /^https:\/\//.test(body.redirectTo) ? body.redirectTo : undefined;

  const findUser = async () => {
    for (let page = 1; page <= 10; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw error;
      const users = (data?.users ?? []) as Array<{ id: string; email?: string }>;
      const hit = users.find((u) => u.email?.toLowerCase() === email);
      if (hit || users.length < 200) return hit ?? null;
    }
    return null;
  };

  if (body.action !== 'invite') return json(400, { error: 'Unknown action.' });

  try {
    // a) Add or update them on the team list (only when profile details were sent).
    if (body.role || body.name || body.locations) {
      const role: Role = ROLES.includes(body.role as Role) ? (body.role as Role) : 'manager';
      const name = (body.name || '').trim() || email;
      const locs = role === 'admin' ? [] : (Array.isArray(body.locations) ? body.locations.map(String) : []);
      const fields = { name, role, status: 'approved', assigned_locations: locs, assigned_location: locs[0] ?? null };
      const { data: profile } = await admin.from('employee_profiles').select('id').ilike('email', email).maybeSingle();
      const { error } = profile
        ? await admin.from('employee_profiles').update(fields).eq('id', profile.id)
        : await admin.from('employee_profiles').insert([{ email, ...fields }]);
      if (error) throw error;
    } else {
      const { data: profile } = await admin.from('employee_profiles').select('id').ilike('email', email).maybeSingle();
      if (!profile) return json(404, { error: 'That email is not on the team list.' });
    }

    // b) Email them: an invite if they have no login yet, otherwise a set-password link.
    const existing = await findUser();
    if (!existing) {
      const { error } = await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo, data: { name: (body.name || '').trim() || undefined },
      });
      if (error) throw error;
      return json(200, { ok: true, sent: 'invite' });
    }
    const { error } = await admin.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw error;
    return json(200, { ok: true, sent: 'reset' });
  } catch (err) {
    console.error('team-user error', err);
    const msg = err instanceof Error ? err.message : 'Something went wrong.';
    if (/rate limit/i.test(msg)) return json(429, { error: 'Email limit reached. Connect an email sender in Supabase (Authentication → Emails → SMTP) or try again in an hour.' });
    return json(500, { error: msg });
  }
}
