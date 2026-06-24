import { NavLink } from "react-router-dom";
import { 
  LayoutDashboard, 
  Users, 
  UtensilsCrossed, 
  CalendarDays, 
  PartyPopper,
  Megaphone,
  Zap,
  Sparkles,
  Bell,
  CheckSquare,
  BarChart3,
  Settings
} from "lucide-react";

export function Sidebar() {
  return (
    <div className="sidebar py-4">
      <div className="px-6 mb-8 flex items-center gap-3">
        <img 
          src="/logo.png" 
          alt="Logo" 
          className="w-8 h-8 object-contain rounded"
          onError={(e) => {
            (e.target as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><rect width="32" height="32" fill="rgb(220, 38, 38)"/><text x="50%" y="50%" fill="white" font-family="sans-serif" font-size="14" font-weight="bold" text-anchor="middle" dominant-baseline="central">SP</text></svg>';
          }}
        />
        <span className="font-bold text-lg text-white tracking-tight leading-tight">Square Peg<br/>Connect</span>
      </div>

      <div className="flex-1 overflow-y-auto px-3 space-y-1">
        
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
          Events
        </NavLink>
        <NavLink to="/tuesday-fundraisers" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <PartyPopper className="w-4 h-4" />
          Tuesday Fundraisers
        </NavLink>

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
        <NavLink to="/reminders" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <Bell className="w-4 h-4" />
          Reminders
        </NavLink>

        <div className="sidebar-group-title">Operations</div>
        <NavLink to="/tasks" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <CheckSquare className="w-4 h-4" />
          Tasks
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
    </div>
  );
}
