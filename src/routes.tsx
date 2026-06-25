import { AppLayout } from "./components/layout/AppLayout";
import Dashboard from "./pages/Dashboard";
import CateringPipeline from "./pages/CateringPipeline";
import FundraisersPipeline from "./pages/FundraisersPipeline";
import B2BPartnerships from "./pages/B2BPartnerships";
import GuestBounceBack from "./pages/GuestBounceBack";
import Campaigns from "./pages/Campaigns";
import Login from "./pages/Login";
import PublicCateringForm from "./pages/PublicCateringForm";
import PublicFundraiserForm from "./pages/PublicFundraiserForm";
import AIPersonalize from "./pages/AIPersonalize";
import Settings from "./pages/Settings";
import Reports from "./pages/Reports";
import Reminders from "./pages/Reminders";
import Contacts from "./pages/Contacts";
import PlaceholderPage from "./components/layout/PlaceholderPage";
import { AuthCallback } from "./pages/AuthCallback";
import { ProtectedRoute } from "./components/ProtectedRoute";
import EventsDashboard from "./pages/EventsDashboard";
import { Navigate } from "react-router-dom";

// Automations placeholder containing the requested workflows
function AutomationsPlaceholder() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Automations & Workflows</h1>
        <p className="text-muted-foreground mt-1">Pre-built sequences for marketing and operations.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="border rounded-lg p-6 bg-card">
          <h3 className="font-semibold text-lg mb-2">6-Month Event Check-in</h3>
          <p className="text-sm text-muted-foreground mb-4">Triggers when it has been 6 months since a contact's last event with us.</p>
          <div className="text-xs bg-muted px-3 py-1 rounded inline-block font-medium">Status: Active</div>
        </div>
        <div className="border rounded-lg p-6 bg-card">
          <h3 className="font-semibold text-lg mb-2">Fundraiser Promo Flow</h3>
          <p className="text-sm text-muted-foreground mb-4">Triggered for Tuesday Fundraisers. Sends details on how it works and promo materials.</p>
          <div className="text-xs bg-muted px-3 py-1 rounded inline-block font-medium">Status: Active</div>
        </div>
        <div className="border rounded-lg p-6 bg-card">
          <h3 className="font-semibold text-lg mb-2">60-Day Catering Follow-up</h3>
          <p className="text-sm text-muted-foreground mb-4">Checks in with catering contacts 60 days after their last completed order.</p>
          <div className="text-xs bg-muted px-3 py-1 rounded inline-block font-medium">Status: Active</div>
        </div>
        <div className="border rounded-lg p-6 bg-card border-dashed">
          <h3 className="font-semibold text-lg mb-2">Monthly Newsletter</h3>
          <p className="text-sm text-muted-foreground mb-4">Self-triggered broadcast to all contacts. Not automated.</p>
          <button className="text-sm font-medium text-primary hover:underline">Draft Newsletter &rarr;</button>
        </div>
      </div>
    </div>
  );
}

export const routes = [
  {
    path: "/public/catering",
    element: <PublicCateringForm />
  },
  {
    path: "/public/fundraisers",
    element: <PublicFundraiserForm />
  },
  {
    path: "/auth/callback",
    element: <AuthCallback />
  },
  {
    path: "/login",
    element: <Login />
  },
  {
    path: "/",
    element: <ProtectedRoute><AppLayout /></ProtectedRoute>,
    children: [
      { index: true, element: <Dashboard /> },
      { path: "contacts", element: <Contacts /> },
      { path: "catering", element: <CateringPipeline /> },
      { path: "events", element: <EventsDashboard /> },
      { path: "tuesday-fundraisers", element: <FundraisersPipeline /> },
      { path: "b2b-partnerships", element: <B2BPartnerships /> },
      { path: "guest-bounce-back", element: <GuestBounceBack /> },
      { path: "campaigns", element: <Campaigns /> },
      { path: "team", element: <Navigate to="/settings" replace /> },
      { path: "tasks", element: <Navigate to="/reminders" replace /> },
      { path: "automations", element: <AutomationsPlaceholder /> },
      { path: "ai-personalize", element: <AIPersonalize /> },
      { path: "reminders", element: <Reminders /> },
      { path: "reports", element: <Reports /> },
      { path: "settings", element: <Settings /> },
    ]
  }
];
