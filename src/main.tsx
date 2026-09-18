import { createRoot } from 'react-dom/client'
import { useEffect, useState } from 'react';
import type { UserManagerSettings } from 'oidc-client-ts';
import { AuthProvider, useAuth } from 'react-oidc-context';
import { buildOidcConfig } from './lib/oidc';
import { vibeConfig } from '@/vibe.config';
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

// Every browser read lives INSIDE AuthRoot, behind a mount gate.
function AuthRoot({ children }: { children: React.ReactNode }) {
  // null until the effect runs — that is the mount gate.
  const [oidcConfig, setOidcConfig] = useState<UserManagerSettings | null>(null);
  
  useEffect(() => {
    setOidcConfig(buildOidcConfig());
  }, []);

  // Every conditional return is below all hooks.

  // Sign-in is still provisioning — a defined state, never a spinner
  // forever. This guard belongs HERE, inside AuthRoot, so it survives being
  // mounted in a server-rendered root.
  if (!vibeConfig.sso.clientId) {
    return (
      <div role="status" aria-busy="true" className="h-screen w-screen flex flex-col items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
        <p className="text-muted-foreground">Setting up sign-in… this finishes automatically.</p>
      </div>
    );
  }
  
  if (!oidcConfig) {
    return (
      <div aria-busy="true" className="h-screen w-screen flex flex-col items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Safe here: only reached on the client, past the mount gate.
  const isAuthPopup =
    !!window.opener && window.location.pathname.endsWith('/auth/callback');

  return (
    <AuthProvider {...oidcConfig} skipSigninCallback={isAuthPopup}>
      <SessionGuard>
        <AccessGuard>
          {children}
        </AccessGuard>
      </SessionGuard>
    </AuthProvider>
  );
}

// design.css is @import'ed from index.css so it shares the Tailwind PostCSS
// pass — don't import it here.

createRoot(document.getElementById("root")!).render(
  <AuthRoot>
    <App />
  </AuthRoot>
);

