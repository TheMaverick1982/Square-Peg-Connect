import { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "react-oidc-context";
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

export function EmployeeProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadProfile() {
      if (!auth.isAuthenticated || !auth.user?.profile?.email) {
        setIsLoading(false);
        return;
      }

      const email = auth.user.profile.email;
      
      const { data, error } = await supabase
        .from("employee_profiles")
        .select("*")
        .eq("email", email)
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("Error loading employee profile:", error);
      } else if (data) {
        let currentProfile = data as EmployeeProfile;
        
        // Auto-upgrade to Admin if they match the list but aren't admin yet
        const adminEmails = ["growth@themaverick.ai", "hr@squarepegpizzeria.com", "catering@squarepegpizzeria.com", "brian@brianhardy.com"];
        if (adminEmails.includes(email.toLowerCase()) && currentProfile.role !== "admin") {
          const { data: updated, error: updateErr } = await supabase
            .from("employee_profiles")
            .update({ role: "admin" })
            .eq("id", currentProfile.id)
            .select()
            .single();
          if (updated && !updateErr) {
            currentProfile = updated as EmployeeProfile;
          }
        }
        
        setProfile(currentProfile);
      } else {
        // Create an initial profile if they don't exist yet
        
        // Auto-assign Admin role to specific emails
        const adminEmails = ["growth@themaverick.ai", "hr@squarepegpizzeria.com", "catering@squarepegpizzeria.com", "brian@brianhardy.com"];
        const assignedRole = adminEmails.includes(email.toLowerCase()) ? "admin" : "manager";

        const newProfile = {
          email,
          name: auth.user.profile.name || email,
          role: assignedRole as EmployeeRole, // Default new users to manager, unless specified above
          status: "approved",
          assigned_locations: []
        };
        
        const { data: created, error: insertError } = await supabase
          .from("employee_profiles")
          .insert([newProfile])
          .select()
          .single();
          
        if (!insertError && created) {
          setProfile(created as EmployeeProfile);
        }
      }
      
      setIsLoading(false);
    }

    loadProfile();
  }, [auth.isAuthenticated, auth.user?.profile?.email]);

  return (
    <EmployeeContext.Provider value={{ profile, isLoading }}>
      {children}
    </EmployeeContext.Provider>
  );
}

export function useEmployee() {
  return useContext(EmployeeContext);
}
