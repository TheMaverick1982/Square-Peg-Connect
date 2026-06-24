import { createRoot } from 'react-dom/client'
import { useEffect } from 'react';
import { AuthProvider, useAuth } from 'react-oidc-context';
import { oidcConfig } from './lib/oidc';
import { AccessGuard } from './components/AccessGuard';
import App from './App.tsx'
import './index.css'
import './theme.css'

// SessionGuard subscribes to silent-renew failure and redirects to sign-in
// when the access token can't be refreshed (SSO session expired, network
// partition, etc.). Without it, users get stuck with isAuthenticated=false
// and stale tokens — the app looks logged-in but every API call 401s.
// REQUIRED child of <AuthProvider>. Do not remove.
function SessionGuard({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  useEffect(() => {
    return auth.events.addSilentRenewError(() => {
      auth.signinRedirect();
    });
  }, [auth]);
  return <>{children}</>;
}

const isAuthPopup =
  !!window.opener && window.location.pathname.endsWith('/auth/callback');

// design.css is @import'ed from index.css so it shares the Tailwind PostCSS
// pass — don't import it here.

createRoot(document.getElementById("root")!).render(
  <AuthProvider {...oidcConfig} skipSigninCallback={isAuthPopup}>
    <SessionGuard>
      <AccessGuard>
        <App />
      </AccessGuard>
    </SessionGuard>
  </AuthProvider>
);

