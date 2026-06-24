import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bbklhfmwfrqkzpiupkqn.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJia2xoZm13ZnJxa3pwaXVwa3FuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyOTE4NjcsImV4cCI6MjA5Nzg2Nzg2N30.Vq60OzW61bbs6gvv6eCE2od6FPqFZ8Vj4LJlDKRdgcI';

export const supabase = createClient(supabaseUrl, supabaseKey);
