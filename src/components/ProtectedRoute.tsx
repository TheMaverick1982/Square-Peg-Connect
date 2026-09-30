import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { useEmployee } from '@/lib/EmployeeContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

function FullScreenSpinner() {
  return (
    <div aria-busy="true" className="h-screen w-screen flex items-center justify-center bg-background">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );
}

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const { profile, isLoading } = useEmployee();
  const location = useLocation();

  if (auth.isLoading) return <FullScreenSpinner />;
  if (!auth.isAuthenticated || auth.isRecovery) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (isLoading) return <FullScreenSpinner />;

  if (!profile || profile.status === 'disabled') {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background p-4">
        <Card role="alert" className="max-w-md w-full p-6 text-center shadow-lg">
          <h2 className="text-xl font-semibold mb-2">No access yet</h2>
          <p className="text-muted-foreground mb-6">
            You're signed in as <span className="font-medium text-foreground">{auth.user?.email}</span>, but
            this email isn't on the Square Peg Connect team list. Ask an admin to add you in Settings → Team.
          </p>
          <Button variant="outline" className="w-full" onClick={() => auth.signOut()}>
            Sign out
          </Button>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
