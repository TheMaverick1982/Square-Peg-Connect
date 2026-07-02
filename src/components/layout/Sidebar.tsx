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
  Store
} from "lucide-react";
import { useEmployee } from "@/lib/EmployeeContext";

export function SidebarContent() {
  const { profile } = useEmployee();
  const isAdmin = profile?.role === "admin";

  return (
    <>
      <div className="px-6 mb-8 mt-4 flex flex-col items-center gap-2">
        <img 
          src="https://media-api-prod.apigateway.co/files/v3/AG-D5HZKZ2TNH/FileID-2859e6a7-48eb-46ed-83a6-9d6ebb5d5850/uploaded-1782298633843015700.png" 
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
        <NavLink to="/b2b-partnerships" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <Handshake className="w-4 h-4" />
          B2B Partnerships
        </NavLink>
        <NavLink to="/guest-bounce-back" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <UserCheck className="w-4 h-4" />
          Guest Bounce Back
        </NavLink>

        {isAdmin && (
          <>
            <div className="sidebar-group-title">Administration</div>
            <NavLink to="/team" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
              <ShieldCheck className="w-4 h-4" />
              Team Management
            </NavLink>
          </>
        )}

        <div className="sidebar-group-title">Marketing</div>
        <NavLink to="/campaigns" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <Megaphone className="w-4 h-4" />
          Campaigns
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