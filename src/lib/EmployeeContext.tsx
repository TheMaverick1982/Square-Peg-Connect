import { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "./auth";
import { supabase } from "./supabase";

export type EmployeeRole = "admin" | "employee" | "manager";

export interface EmployeeProfile {
  id: string;
  email: string;
  name: string;
  role: EmployeeRole;
  status: string;
  assigned_location: string | null; // Legacy, to be removed eventually
  assigned_locations: string[];
}

interface EmployeeContextType {
  profile: EmployeeProfile | null;
  isLoading: boolean;
}

const EmployeeContext = createContext<EmployeeContextType>({
  profile: null,
  isLoading: true,
});

// Bootstrap admins: if one of these signs in and has no team profile yet,
// an admin profile is created so the app can never be locked out.
// Everyone else must be added by an admin in Settings → Team first.
export const BOOTSTRAP_ADMIN_EMAILS = [
  "brian@brianhardy.com",
  "hr@squarepegpizzeria.com",
  "catering@squarepegpizzeria.com",
  "growth@themaverick.ai",
];

export function EmployeeProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const email = user?.email?.toLowerCase() ?? null;

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      if (authLoading) return;
      if (!email) {
        setProfile(null);
        setIsLoading(false);
        return;
      }
      setIsLoading(true);

      // Tolerant lookup: ignores capitals and stray spaces, and copes with duplicate entries
      // for the same email (picks the best one instead of locking the person out).
      const { data: rows, error } = await supabase
        .from("employee_profiles")
        .select("*")
        .ilike("email", `%${email.replace(/[%_]/g, "\\$&")}%`);

      if (cancelled) return;

      const rank: Record<string, number> = { admin: 0, manager: 1, employee: 2 };
      const matches = ((rows || []) as EmployeeProfile[])
        .filter((r) => (r.email || "").trim().toLowerCase() === email)
        .sort((x, y) =>
          Number(x.status === "disabled") - Number(y.status === "disabled") ||
          (rank[x.role] ?? 9) - (rank[y.role] ?? 9));
      const data = matches[0] ?? null;

      if (error) {
        console.error("Error loading employee profile:", error);
        setProfile(null);
      } else if (data) {
        setProfile(data);
      } else if (BOOTSTRAP_ADMIN_EMAILS.includes(email)) {
        const { data: created, error: insertError } = await supabase
          .from("employee_profiles")
          .insert([{
            email,
            name: (user?.user_metadata?.name as string) || email,
            role: "admin",
            status: "approved",
            assigned_locations: [],
            assigned_location: null,
          }])
          .select()
          .single();
        if (!cancelled) setProfile(insertError ? null : (created as EmployeeProfile));
      } else {
        // Signed in, but not on the team list → no access.
        setProfile(null);
      }

      if (!cancelled) setIsLoading(false);
    }

    loadProfile();
    return () => { cancelled = true; };
  }, [authLoading, email, user?.user_metadata?.name]);

  return (
    <EmployeeContext.Provider value={{ profile, isLoading: authLoading || isLoading }}>
      {children}
    </EmployeeContext.Provider>
  );
}

export function useEmployee() {
  return useContext(EmployeeContext);
}
