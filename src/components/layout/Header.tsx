import { ChevronDown, MapPin, Plus, Search, Bell, LogOut, User, Menu, UtensilsCrossed, PartyPopper, Handshake, CheckSquare } from "lucide-react";
import { useLocationContext } from "@/lib/LocationContext";
import { useEmployee } from "@/lib/EmployeeContext";
import { locations } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { useAuth } from "react-oidc-context";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { SidebarContent } from "./Sidebar";
import { format } from "date-fns";

export function Header() {
  const navigate = useNavigate();
  const { selectedLocationId, setSelectedLocationId } = useLocationContext();
  const { profile } = useEmployee();
  const auth = useAuth();
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  
  const assignedLocs = Array.isArray(profile?.assigned_locations) && profile.assigned_locations.length > 0 
    ? profile.assigned_locations 
    : (profile?.assigned_location ? [profile.assigned_location] : []);
  const isLocked = profile?.role !== "admin" && assignedLocs.length === 1;
  const hasAccessToAll = profile?.role === "admin";

  // Fetch active alerts based on location
  const { data: alerts = [] } = useQuery({
    queryKey: ['header_alerts', selectedLocationId],
    queryFn: async () => {
      const activeAlerts = [];

      // 1. Pending Catering (Waiting on you / Requested)
      let cateringQuery = supabase.from('catering_requests').select('id, company, status, created_at').in('status', ['Waiting on you', 'Requested']);
      if (selectedLocationId) cateringQuery = cateringQuery.eq('location', selectedLocationId);
      const { data: cateringData } = await cateringQuery;
      
      if (cateringData) {
        cateringData.forEach(item => {
          activeAlerts.push({
            id: `cat-${item.id}`,
            type: 'catering',
            title: 'Action Required: Catering',
            desc: `${item.company || 'New lead'} - ${item.status}`,
            date: item.created_at,
            onClick: () => { setIsAlertsOpen(false); navigate('/catering'); }
          });
        });
      }

      // 2. Pending Fundraisers (Requested)
      let fundQuery = supabase.from('fundraisers').select('id, organization, created_at').eq('status', 'Requested');
      if (selectedLocationId) fundQuery = fundQuery.eq('location', selectedLocationId);
      const { data: fundData } = await fundQuery;

      if (fundData) {
        fundData.forEach(item => {
          activeAlerts.push({
            id: `fund-${item.id}`,
            type: 'fundraiser',
            title: 'New Fundraiser Request',
            desc: item.organization || 'Review required',
            date: item.created_at,
            onClick: () => { setIsAlertsOpen(false); navigate('/tuesday-fundraisers'); }
          });
        });
      }

      // 3. Pending Reminders/Tasks
      let tasksQuery = supabase.from('reminders').select('id, title, due_date').eq('is_completed', false);
      if (selectedLocationId) tasksQuery = tasksQuery.eq('location_id', selectedLocationId);
      const { data: tasksData } = await tasksQuery;

      if (tasksData) {
        tasksData.forEach(item => {
          activeAlerts.push({
            id: `task-${item.id}`,
            type: 'task',
            title: 'Pending Task',
            desc: item.title,
            date: item.due_date || new Date().toISOString(),
            onClick: () => { setIsAlertsOpen(false); navigate('/reminders'); }
          });
        });
      }

      // Sort by newest first
      return activeAlerts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    },
    // Poll every 30 seconds
    refetchInterval: 30000 
  });

  return (
    <div className="header gap-2 sm:gap-4 px-3 sm:px-6">
      <div className="flex items-center gap-2 sm:gap-4">
        {/* Mobile Hamburger Menu */}
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden">
              <Menu className="w-5 h-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[280px] p-0 bg-[hsl(var(--sidebar-bg))] text-[hsl(var(--sidebar-text))] border-r-zinc-800 flex flex-col">
            <SidebarContent />
          </SheetContent>
        </Sheet>

        <div className="flex items-center text-sm font-medium text-muted-foreground border border-border rounded-md px-2 sm:px-3 py-1.5 bg-muted/50 w-full max-w-[150px] sm:max-w-none">
          <MapPin className="w-4 h-4 mr-1 sm:mr-2 text-primary shrink-0" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                className="w-full sm:w-[180px] border-0 bg-transparent p-0 h-auto focus:ring-0 shadow-none text-foreground font-semibold disabled:opacity-100 justify-start hover:bg-transparent" 
                disabled={isLocked}
              >
                <span className="truncate">
                  {!selectedLocationId 
                    ? "All Locations" 
                    : locations.find(l => l.id === selectedLocationId)?.name || "Select Location"}
                </span>
                {!isLocked && <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[200px]" align="start">
              {hasAccessToAll && (
                <DropdownMenuItem onClick={() => setSelectedLocationId(null)} className="font-medium">
                  All Locations
                </DropdownMenuItem>
              )}
              {locations.filter(loc => hasAccessToAll || assignedLocs.includes(loc.id)).map(loc => (
                <DropdownMenuItem 
                  key={loc.id} 
                  onClick={() => setSelectedLocationId(loc.id)}
                  className={selectedLocationId === loc.id ? "bg-primary/10 text-primary font-medium" : ""}
                >
                  {loc.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        <div className="relative hidden md:block">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input 
            type="text" 
            placeholder="Search CRM..." 
            className="h-9 w-64 rounded-md border border-input bg-transparent pl-9 pr-4 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
        
        {/* Mobile search icon only */}
        <Button variant="ghost" size="icon" className="md:hidden text-muted-foreground">
          <Search className="w-5 h-5" />
        </Button>

        <Popover open={isAlertsOpen} onOpenChange={setIsAlertsOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="relative text-muted-foreground">
              <Bell className="w-4 h-4" />
              {alerts.length > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-destructive border-2 border-card" />
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <span className="text-sm font-semibold">Action Items</span>
              <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">{alerts.length} pending</span>
            </div>
            <div className="max-h-[300px] overflow-y-auto">
              {alerts.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  You're all caught up!
                </div>
              ) : (
                <div className="divide-y">
                  {alerts.map(alert => (
                    <button 
                      key={alert.id}
                      onClick={alert.onClick}
                      className="w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors flex flex-col gap-1"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className={`text-xs font-semibold ${
                          alert.type === 'catering' ? 'text-orange-600 dark:text-orange-400' :
                          alert.type === 'fundraiser' ? 'text-green-600 dark:text-green-400' :
                          'text-blue-600 dark:text-blue-400'
                        }`}>
                          {alert.title}
                        </span>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {format(new Date(alert.date), "MMM d")}
                        </span>
                      </div>
                      <span className="text-sm font-medium line-clamp-1">{alert.desc}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" className="hidden sm:flex gap-2">
              <Plus className="w-4 h-4" />
              New Intake
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>Quick Create</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => navigate('/catering')}>
                <UtensilsCrossed className="mr-2 h-4 w-4" />
                <span>Catering Request</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/tuesday-fundraisers')}>
                <PartyPopper className="mr-2 h-4 w-4" />
                <span>Tuesday Fundraiser</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/b2b-partnerships')}>
                <Handshake className="mr-2 h-4 w-4" />
                <span>B2B Contact</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/reminders')}>
                <CheckSquare className="mr-2 h-4 w-4" />
                <span>Task / Reminder</span>
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-8 h-8 shrink-0 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary font-bold text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
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
