import { useAuth } from 'react-oidc-context';
import { Navigate } from 'react-router-dom';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  if (auth.isLoading) return <div className="h-screen w-screen flex items-center justify-center">Loading authentication...</div>;
  if (!auth.isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
