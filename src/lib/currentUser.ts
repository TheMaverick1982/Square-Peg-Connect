import { supabase } from "@/lib/supabase";

/** Signed-in team member's email (lowercase), for "Intake by" on requests added in Connect. */
export async function currentUserEmail(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.email?.trim().toLowerCase() || null;
}
