import { Navigate } from "react-router-dom";
import { useEmployee } from "@/lib/EmployeeContext";
import { useIsOwner } from "@/lib/featureAccess";

/** Renders children only for owner logins; everyone else is sent to the dashboard. */
export function OwnerOnly({ children }: { children: React.ReactNode }) {
  const { isLoading } = useEmployee();
  const isOwner = useIsOwner();
  if (isLoading) return null;
  if (!isOwner) return <Navigate to="/" replace />;
  return <>{children}</>;
}
