import { MapPin, Plus, Search, Bell, LogOut, User } from "lucide-react";
import { useLocationContext } from "@/lib/LocationContext";
import { locations } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { useAuth } from "react-oidc-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function Header() {
  const { selectedLocationId, setSelectedLocationId } = useLocationContext();
  const auth = useAuth();

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
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary font-bold text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
              {auth.user?.profile?.name?.charAt(0).toUpperCase() || "SP"}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{auth.user?.profile?.name || "Square Peg User"}</p>
                <p className="text-xs leading-none text-muted-foreground">{auth.user?.profile?.email || "user@squarepeg.com"}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <User className="mr-2 h-4 w-4" />
              <span>Profile</span>
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => {
                auth.signoutRedirect({
                  extraQueryParams: { namespace: 'RZG9' },
                });
              }}
              className="text-destructive focus:bg-destructive focus:text-destructive-foreground"
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>Sign out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
