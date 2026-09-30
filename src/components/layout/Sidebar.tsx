import { NavLink } from "react-router-dom";
import { 
  LayoutDashboard, 
  Users, 
  UtensilsCrossed, 
  CalendarDays, 
  PartyPopper,
  Handshake,
  UserCheck,
  Megaphone,
  Zap,
  Sparkles,
  CheckSquare,
  BarChart3,
  Settings,
  ShieldCheck,
  Store,
  Lock,
  CalendarRange,
  Camera
} from "lucide-react";
import { useEmployee } from "@/lib/EmployeeContext";
import { useToast } from "@/hooks/use-toast";

export function SidebarContent() {
  const { profile } = useEmployee();
  const isAdmin = profile?.role === "admin";
  const { toast } = useToast();

  return (
    <>
      <div className="px-6 mb-8 mt-4 flex flex-col items-center gap-2">
        <img 
          src="/square-peg-logo.png" 
          alt="Square Peg Pizzeria Logo" 
          className="h-12 w-auto object-contain"
        />
        <span className="font-bold text-xs text-white/70 uppercase tracking-widest">Connect</span>
      </div>

      <div className="flex-1 overflow-y-auto px-3 space-y-1 pb-6">
        
        <div className="sidebar-group-title mt-0">Workspace</div>
        <NavLink to="/" end className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <LayoutDashboard className="w-4 h-4" />
          Dashboard
        </NavLink>
        <NavLink to="/master-calendar" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <CalendarRange className="w-4 h-4" />
          Master Calendar
        </NavLink>
        <NavLink to="/contacts" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <Users className="w-4 h-4" />
          Contacts
        </NavLink>
        <NavLink to="/catering" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <UtensilsCrossed className="w-4 h-4" />
          Catering Orders
        </NavLink>
        <NavLink to="/events" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <CalendarDays className="w-4 h-4" />
          Entertainment
        </NavLink>
        <NavLink to="/tuesday-fundraisers" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <PartyPopper className="w-4 h-4" />
          Tuesday Fundraisers
        </NavLink>
        <NavLink to="/store-events" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <Store className="w-4 h-4" />
          Store Events
        </NavLink>
        <NavLink to="/large-reservations" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <Users className="w-4 h-4" />
          Large Reservations
        </NavLink>
        <NavLink to="/b2b-partnerships" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <Handshake className="w-4 h-4" />
          B2B Partnerships
        </NavLink>
        <NavLink to="/guest-bounce-back" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <UserCheck className="w-4 h-4" />
          Guest Bounce Back
        </NavLink>

        <div className="sidebar-group-title">Administration</div>
        <NavLink 
          to={isAdmin ? "/team" : "#"} 
          onClick={(e) => {
            if (!isAdmin) {
              e.preventDefault();
              toast({ 
                title: "Access Restricted", 
                description: "You must be logged in as an Administrator to view Team Management.", 
                variant: "destructive" 
              });
            }
          }}
          className={({ isActive }) => `sidebar-link ${isActive && isAdmin ? 'active' : ''} ${!isAdmin ? 'opacity-50 hover:bg-transparent hover:text-muted-foreground' : ''}`}
        >
          <ShieldCheck className="w-4 h-4" />
          Team Management
          {!isAdmin && <Lock className="w-3 h-3 ml-auto text-muted-foreground" />}
        </NavLink>

        <div className="sidebar-group-title">Marketing</div>
        <NavLink to="/campaigns" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <Megaphone className="w-4 h-4" />
          Marketing Planner
        </NavLink>
        <NavLink to="/staff-photos" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <Camera className="w-4 h-4" />
          Staff Photos
        </NavLink>
        <NavLink to="/automations" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <Zap className="w-4 h-4" />
          Automations
        </NavLink>
        <NavLink to="/ai-personalize" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <Sparkles className="w-4 h-4" />
          AI Personalize
        </NavLink>

        <div className="sidebar-group-title">Operations</div>
        <NavLink to="/reminders" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <CheckSquare className="w-4 h-4" />
          Tasks & Reminders
        </NavLink>
        <NavLink to="/reports" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <BarChart3 className="w-4 h-4" />
          Reports
        </NavLink>
        <NavLink to="/settings" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <Settings className="w-4 h-4" />
          Settings
        </NavLink>
      </div>
    </>
  );
}

export function Sidebar() {
  return (
    <div className="sidebar py-4 hidden md:flex">
      <SidebarContent />
    </div>
  );
}