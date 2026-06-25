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
  assigned_location: string | null;
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
        setProfile(data as EmployeeProfile);
      } else {
        // Create an initial profile if they don't exist yet
        const newProfile = {
          email,
          name: auth.user.profile.name || email,
          role: "manager" as EmployeeRole, // Default new users to manager
          status: "approved",
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
