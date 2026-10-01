import { AppLayout } from "./components/layout/AppLayout";
import Dashboard from "./pages/Dashboard";
import MasterCalendar from "./pages/MasterCalendar";
import CateringPipeline from "./pages/CateringPipeline";
import FundraisersPipeline from "./pages/FundraisersPipeline";
import B2BPartnerships from "./pages/B2BPartnerships";
import GuestBounceBack from "./pages/GuestBounceBack";
import Campaigns from "./pages/Campaigns";
import Automations from "./pages/Automations";
import Login from "./pages/Login";
import PublicCateringForm from "./pages/PublicCateringForm";
import PublicFundraiserForm from "./pages/PublicFundraiserForm";
import AIPersonalize from "./pages/AIPersonalize";
import Settings from "./pages/Settings";
import Reports from "./pages/Reports";
import Reminders from "./pages/Reminders";
import Contacts from "./pages/Contacts";
import { ProtectedRoute } from "./components/ProtectedRoute";
import EventsDashboard from "./pages/EventsDashboard";
import StoreEventsPipeline from "./pages/StoreEventsPipeline";
import LargeReservationsPipeline from "./pages/LargeReservationsPipeline";
import PublicLargeReservationForm from "./pages/PublicLargeReservationForm";
import PublicPhotoUpload from "./pages/PublicPhotoUpload";
import PublicMarketingRequestForm from "./pages/PublicMarketingRequestForm";
import StaffPhotos from "./pages/StaffPhotos";
import StoreMetrics from "./pages/StoreMetrics";
import { Navigate } from "react-router-dom";

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
    path: "/public/large-reservations",
    element: <PublicLargeReservationForm />
  },
  {
    path: "/public/photo-upload",
    element: <PublicPhotoUpload />
  },
  {
    path: "/public/marketing-request",
    element: <PublicMarketingRequestForm />
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
      { path: "master-calendar", element: <MasterCalendar /> },
      { path: "contacts", element: <Contacts /> },
      { path: "catering", element: <CateringPipeline /> },
      { path: "events", element: <EventsDashboard /> },
      { path: "tuesday-fundraisers", element: <FundraisersPipeline /> },
      { path: "store-events", element: <StoreEventsPipeline /> },
      { path: "large-reservations", element: <LargeReservationsPipeline /> },
      { path: "b2b-partnerships", element: <B2BPartnerships /> },
      { path: "guest-bounce-back", element: <GuestBounceBack /> },
      { path: "campaigns", element: <Campaigns /> },
      { path: "staff-photos", element: <StaffPhotos /> },
      { path: "team", element: <Navigate to="/settings" replace /> },
      { path: "tasks", element: <Navigate to="/reminders" replace /> },
      { path: "automations", element: <Automations /> },
      { path: "ai-personalize", element: <AIPersonalize /> },
      { path: "reminders", element: <Reminders /> },
      { path: "reports", element: <Reports /> },
      { path: "store-metrics", element: <StoreMetrics /> },
      { path: "settings", element: <Settings /> },
    ]
  }
];
