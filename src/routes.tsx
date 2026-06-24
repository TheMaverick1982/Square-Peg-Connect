import { AppLayout } from "./components/layout/AppLayout";
import Dashboard from "./pages/Dashboard";
import CateringPipeline from "./pages/CateringPipeline";
import PlaceholderPage from "./components/layout/PlaceholderPage";

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

// Tuesday Fundraisers placeholder 
function FundraisersPlaceholder() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tuesday Fundraisers</h1>
          <p className="text-muted-foreground mt-1">Track turnout, revenue, and contact details for all fundraiser events.</p>
        </div>
        <button className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium">Log New Fundraiser</button>
      </div>
      <div className="border rounded-lg bg-card p-12 text-center text-muted-foreground">
        <p>Fundraiser tracker view goes here. This will display a list of all events, tied to their specific B2B contact, showing "Customers Attended" and "Revenue Generated".</p>
      </div>
    </div>
  );
}

export const routes = [
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: "contacts", element: <PlaceholderPage title="Contacts" description="Global and location-specific contact directory." /> },
      { path: "catering", element: <CateringPipeline /> },
      { path: "events", element: <PlaceholderPage title="Events" description="Calendar view of upcoming events across locations." /> },
      { path: "tuesday-fundraisers", element: <FundraisersPlaceholder /> },
      { path: "campaigns", element: <PlaceholderPage title="Campaigns" description="Manage email and SMS campaigns." /> },
      { path: "automations", element: <AutomationsPlaceholder /> },
      { path: "ai-personalize", element: <PlaceholderPage title="AI Personalize" description="AI website scraping for custom messaging." /> },
      { path: "reminders", element: <PlaceholderPage title="Reminders" description="Call reminders and auto-workflow triggers." /> },
      { path: "tasks", element: <PlaceholderPage title="Tasks" description="Internal team task management." /> },
      { path: "reports", element: <PlaceholderPage title="Reports" description="Revenue, turnout, and pipeline analytics." /> },
      { path: "settings", element: <PlaceholderPage title="Settings" description="Location mappings, Vendesta sync, and user roles." /> },
    ]
  }
];
