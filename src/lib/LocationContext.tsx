import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { locations, type Location } from "./data";
import { useEmployee } from "./EmployeeContext";

interface LocationContextType {
  selectedLocationId: string | null; // null means 'All Locations'
  setSelectedLocationId: (id: string | null) => void;
  selectedLocation: Location | undefined;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export function LocationProvider({ children }: { children: ReactNode }) {
  const { profile, isLoading } = useEmployee();
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);

  // Auto-lock or default the location if the employee is assigned to specific ones
  useEffect(() => {
    if (!isLoading && profile) {
      if (profile.role !== "admin") {
        const locs = profile.assigned_locations?.length > 0 ? profile.assigned_locations : (profile.assigned_location ? [profile.assigned_location] : []);
        if (locs.length === 1) {
          setSelectedLocationId(locs[0]);
        } else if (locs.length > 1 && !locs.includes(selectedLocationId as string)) {
          setSelectedLocationId(locs[0]);
        }
      }
    }
  }, [profile, isLoading, selectedLocationId]);

  const selectedLocation = selectedLocationId 
    ? locations.find((l) => l.id === selectedLocationId) 
    : undefined;

  // Intercept setter to prevent managers from viewing other locations
  const handleSetLocation = (id: string | null) => {
    if (profile?.role !== "admin") {
      const locs = profile?.assigned_locations?.length > 0 ? profile.assigned_locations : (profile?.assigned_location ? [profile.assigned_location] : []);
      if (locs.length === 1) {
        return;
      } else if (locs.length > 1 && id && !locs.includes(id)) {
        return;
      } else if (locs.length > 1 && !id) {
        return;
      }
    }
    setSelectedLocationId(id);
  };

  return (
    <LocationContext.Provider 
      value={{ 
        selectedLocationId, 
        setSelectedLocationId: handleSetLocation, 
        selectedLocation 
      }}
    >
      {children}
    </LocationContext.Provider>
  );
}

export function useLocationContext() {
  const context = useContext(LocationContext);
  if (context === undefined) {
    throw new Error("useLocationContext must be used within a LocationProvider");
  }
  return context;
}
