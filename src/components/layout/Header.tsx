import { MapPin, Plus, Search, Bell } from "lucide-react";
import { useLocationContext } from "@/lib/LocationContext";
import { locations } from "@/lib/data";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function Header() {
  const { selectedLocationId, setSelectedLocationId } = useLocationContext();

  return (
    <div className="header">
      <div className="flex items-center gap-4">
        <div className="flex items-center text-sm font-medium text-muted-foreground border border-border rounded-md px-3 py-1.5 bg-muted/50">
          <MapPin className="w-4 h-4 mr-2 text-primary" />
          <Select 
            value={selectedLocationId || "all"} 
            onValueChange={(val) => setSelectedLocationId(val === "all" ? null : val)}
          >
            <SelectTrigger className="w-[180px] border-0 bg-transparent p-0 h-auto focus:ring-0 shadow-none text-foreground font-semibold">
              <SelectValue placeholder="All Locations" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Locations</SelectItem>
              {locations.map(loc => (
                <SelectItem key={loc.id} value={loc.id}>
                  {loc.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input 
            type="text" 
            placeholder="Search CRM..." 
            className="h-9 w-64 rounded-md border border-input bg-transparent pl-9 pr-4 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
        <Button variant="ghost" size="icon" className="text-muted-foreground">
          <Bell className="w-4 h-4" />
        </Button>
        <Button size="sm" className="gap-2">
          <Plus className="w-4 h-4" />
          New Intake
        </Button>
        <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary font-bold text-sm">
          SP
        </div>
      </div>
    </div>
  );
}
