import { createClient } from '@supabase/supabase-js';
import { vibeConfig } from '@/vibe.config';

export const isSupabaseConfigured =
  Boolean(vibeConfig.supabase.url) && Boolean(vibeConfig.supabase.publishableKey);

export const supabase = isSupabaseConfigured
  ? createClient(vibeConfig.supabase.url, vibeConfig.supabase.publishableKey)
  : null;
