import { createClient } from '@supabase/supabase-js';

// These two values are public by design (they ship to every browser).
// Data is protected by Supabase Row Level Security, not by hiding these.
// Override per-environment in Vercel with VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY.
const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://tsrnpmkipdbtwyrlfbuy.supabase.co';
const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  'sb_publishable_UMd0Ij8NxKSCoP_13XA3vQ_58KxPUOP';

export const isSupabaseConfigured = true;

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
