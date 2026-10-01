import { supabase } from './supabase';

/** Adds/updates a team member (when details are given) and emails them a link to set their password. */
export async function inviteTeamMember(body: {
  email: string;
  name?: string;
  role?: string;
  locations?: string[];
}) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Session expired. Sign in again.');

  const res = await fetch('/api/team-user', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ action: 'invite', redirectTo: `${window.location.origin}/login`, ...body }),
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(out.error || `Request failed (${res.status})`);
  return out as { ok: true; sent: 'invite' | 'reset' };
}

/** Removes someone from the team list (they lose Connect access). */
export async function removeTeamMember(id: string) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Session expired. Sign in again.');
  const res = await fetch('/api/team-user', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ action: 'remove', id }),
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(out.error || `Request failed (${res.status})`);
}
