import { useEmployee } from "./EmployeeContext";

// Sections hidden from everyone except these logins (handled in another system for now).
// To show them to everyone again, empty this list's gate by adding emails or removing the checks.
export const OWNER_ONLY_EMAILS = ["brian@brianhardy.com"];

export function useIsOwner(): boolean {
  const { profile } = useEmployee();
  return !!profile?.email && OWNER_ONLY_EMAILS.includes(profile.email.toLowerCase());
}
