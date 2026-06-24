import { createContext, useContext, useState, type ReactNode } from "react";
import { locations, type Location } from "./data";

interface LocationContextType {
  selectedLocationId: string | null; // null means 'All Locations'
  setSelectedLocationId: (id: string | null) => void;
  selectedLocation: Location | undefined;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export function LocationProvider({ children }: { children: ReactNode }) {
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);

  const selectedLocation = selectedLocationId 
    ? locations.find((l) => l.id === selectedLocationId) 
    : undefined;

  return (
    <LocationContext.Provider 
      value={{ 
        selectedLocationId, 
        setSelectedLocationId, 
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
