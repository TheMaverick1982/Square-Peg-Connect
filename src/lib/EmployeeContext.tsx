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
      if (!auth.isAuthenticated || !auth.user?.profile) {
        setIsLoading(false);
        return;
      }

      const possibleEmail = (
        auth.user.profile.email || 
        auth.user.profile.preferred_username || 
        auth.user.profile.upn || 
        auth.user.profile.unique_name ||
        auth.user.profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'] ||
        auth.user.profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/upn'] ||
        auth.user.profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name']
      ) as string;
      
      const email = possibleEmail || "unknown";
      
      // If we genuinely can't extract an email, we still want them to have a profile
      // so we use their subject (ID) as a fallback so they aren't stuck loading forever.
      const lookupKey = email !== "unknown" ? email : auth.user.profile.sub;
      
      const { data, error } = await supabase
        .from("employee_profiles")
        .select("*")
        .eq("email", lookupKey)
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("Error loading employee profile:", error);
      } else if (data) {
        let currentProfile = data as EmployeeProfile;
        
        const normalizedEmail = lookupKey.toLowerCase();
        
        // Extract a robust name string for checking
        const rawName = auth.user.profile.name || 
          `${auth.user.profile.given_name || ''} ${auth.user.profile.family_name || ''}`;
        const normalizedName = rawName.trim().toLowerCase();
        
        const isAdminUser = 
          ["growth@themaverick.ai", "hr@squarepegpizzeria.com", "catering@squarepegpizzeria.com", "brian@brianhardy.com"].includes(normalizedEmail) ||
          (normalizedName.includes("brian") && normalizedName.includes("hardy"));

        if (isAdminUser && currentProfile.role !== "admin") {
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
        const normalizedEmail = lookupKey.toLowerCase();
        const rawName = auth.user.profile.name || 
          `${auth.user.profile.given_name || ''} ${auth.user.profile.family_name || ''}`;
        const normalizedName = rawName.trim().toLowerCase();
        const isAdminUser = 
          ["growth@themaverick.ai", "hr@squarepegpizzeria.com", "catering@squarepegpizzeria.com", "brian@brianhardy.com"].includes(normalizedEmail) ||
          (normalizedName.includes("brian") && normalizedName.includes("hardy"));
          
        const assignedRole = isAdminUser ? "admin" : "manager";

        // Auto-assign to a location if their email matches a known location email
        const { locations } = await import("./data");
        const matchingLocation = locations.find(l => l.email?.toLowerCase() === lookupKey.toLowerCase());
        const initialLocations = matchingLocation ? [matchingLocation.id] : [];

        const newProfile = {
          email: lookupKey,
          name: auth.user.profile.name || lookupKey,
          role: assignedRole as EmployeeRole, // Default new users to manager, unless specified above
          status: "approved",
          assigned_locations: initialLocations,
          assigned_location: initialLocations.length > 0 ? initialLocations[0] : null
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
  }, [auth.isAuthenticated, auth.user?.profile?.email, auth.user?.profile?.preferred_username]);

  return (
    <EmployeeContext.Provider value={{ profile, isLoading }}>
      {children}
    </EmployeeContext.Provider>
  );
}

export function useEmployee() {
  return useContext(EmployeeContext);
}
